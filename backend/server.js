const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(frontendDist));

app.get('/health', (req, res) => res.send('OK'));

let latestRecognition = {
    recognized: false,
    message: "Waiting for first recognition...",
    timestamp: new Date().toISOString()
};

app.post('/api/face-recognition', upload.any(), async (req, res) => {
    try {
        let dataArray = [];
        if (req.body.data) {
            try { dataArray = JSON.parse(req.body.data); }
            catch { return res.status(400).json({ error: "Invalid JSON" }); }
        }

        const data = Array.isArray(dataArray) ? (dataArray[0] || {}) : {};
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const byName = name => (req.files || []).find(f => f.fieldname === name);

        const origin = byName('originPic') || null;
        const body = byName('bodyPic') || null;

        const toUrl = f => (f ? `${baseUrl}/uploads/${f.filename}` : null);

        if (!data.personId || !data.name) {
            latestRecognition = {
                recognized: false,
                message: "No user match",
                timestamp: new Date().toISOString(),
                images: {
                    originPic: null,
                    bodyPic: null,
                    facePic: null,
                    personPhoto: null
                },
                rawData: data
            };
            return res.json({ success: true, recognized: false });
        }

        // ✅ Save uploaded originPic/bodyPic directly
        const originUrl = toUrl(origin);
        const bodyUrl = toUrl(body);

        // ✅ Download facePic from device
        let faceUrl = null;
        if (data.facePic && data.deviceIp) {
            const deviceUrl = `http://${data.deviceIp}/resource/${data.facePic}`;
            const savePath = path.join(uploadsDir, `${Date.now()}-${path.basename(data.facePic)}`);
            try {
                const response = await axios.get(deviceUrl, { responseType: "arraybuffer", timeout: 5000 });
                fs.writeFileSync(savePath, response.data);
                faceUrl = `${baseUrl}/uploads/${path.basename(savePath)}`;
            } catch (err) {
                console.log("FacePic download failed:", err.message);
            }
        }

        // ✅ Download registered 'photo'
        let personPhotoUrl = null;
        if (data.photo && data.deviceIp) {
            const deviceUrl = `http://${data.deviceIp}/resource/${data.photo}`;
            const savePath = path.join(uploadsDir, `${Date.now()}-${path.basename(data.photo)}`);
            try {
                const response = await axios.get(deviceUrl, { responseType: "arraybuffer", timeout: 5000 });
                fs.writeFileSync(savePath, response.data);
                personPhotoUrl = `${baseUrl}/uploads/${path.basename(savePath)}`;
            } catch (err) {
                console.log("Person photo download failed:", err.message);
            }
        }

        latestRecognition = {
            recognized: true,
            name: data.name,
            personId: data.personId,
            groupName: data.groupName,
            captureTime: data.captureTime,
            timestamp: new Date().toISOString(),
            images: {
                originPic: originUrl,
                bodyPic: bodyUrl,
                facePic: faceUrl,
                personPhoto: personPhotoUrl
            },
            rawData: data
        };

        res.json({ success: true, recognized: true, name: data.name });

    } catch (err) {
        console.error("SERVER ERROR:", err);
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/face-recognition/latest', (req, res) => {
    res.json(latestRecognition);
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
