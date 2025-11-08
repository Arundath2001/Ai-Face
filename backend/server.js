const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    console.log('🔥 HIT:', req.method, req.url);
    console.log('🔵 HEADERS:', req.headers);
    next();
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
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

app.post('/api/face-recognition', (req, res, next) => {
    console.log('➡️ /api/face-recognition hit');
    next();
});

app.post('/api/face-recognition', upload.any(), async (req, res) => {
    try {
        console.log('📦 FILES:', req.files?.map(f => ({
            field: f.fieldname,
            name: f.originalname,
            saved: f.filename
        })));
        console.log('📄 FIELDS:', req.body);

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

        const urlOrNull = f => (f ? `${baseUrl}/uploads/${f.filename}` : null);

        if (!data.personId || !data.name) {
            latestRecognition = {
                recognized: false,
                message: "No user match",
                timestamp: new Date().toISOString(),
                deviceInfo: {
                    deviceIp: data.deviceIp || null,
                    deviceName: data.deviceName || null,
                    deviceNo: data.deviceNo || null,
                    trackId: data.trackId || null
                },
                images: {
                    originPic: urlOrNull(origin),
                    bodyPic: urlOrNull(body),
                    facePic: null
                },
                rawData: data
            };
            console.log("💾 Saved UNRECOGNIZED");
            return res.json({ success: true, recognized: false });
        }

        let savedFacePicUrl = null;

        if (data.facePic && data.deviceIp) {
            const deviceUrl = `http://${data.deviceIp}/resource/${data.facePic}`;
            const savePath = path.join(uploadsDir, `${Date.now()}-${path.basename(data.facePic)}`);

            try {
                const result = await axios.get(deviceUrl, { responseType: "arraybuffer", timeout: 5000 });
                fs.writeFileSync(savePath, result.data);
                savedFacePicUrl = `${baseUrl}/uploads/${path.basename(savePath)}`;
            } catch (err) {
                console.log("Unable to download facePic:", err.message);
            }
        }

        latestRecognition = {
            recognized: true,
            name: data.name,
            personCode: data.personCode,
            personId: data.personId,
            groupName: data.groupName,
            captureTime: data.captureTime,
            deviceIp: data.deviceIp,
            deviceName: data.deviceName,
            deviceNo: data.deviceNo,
            timestamp: new Date().toISOString(),
            images: {
                originPic: urlOrNull(origin),
                bodyPic: urlOrNull(body),
                facePic: savedFacePicUrl
            },
            metadata: {
                tenantId: data.tenantId,
                captureId: data.captureId,
                recogDeviceId: data.recogDeviceId,
                recogDeviceNo: data.recogDeviceNo,
                trackId: data.trackId
            },
            rawData: data
        };

        console.log("💾 Saved RECOGNIZED");
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
