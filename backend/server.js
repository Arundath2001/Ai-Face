const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.use(express.static(frontendDist));

let latestRecognition = {
    recognized: false,
    message: "Waiting for first recognition...",
    timestamp: new Date().toISOString()
};

app.post('/api/face-recognition', upload.fields([
    { name: 'originPic', maxCount: 1 },
    { name: 'bodyPic', maxCount: 1 },
    { name: 'facePic', maxCount: 1 }
]), (req, res) => {
    try {
        console.log("==== 📩 NEW FACE RECOGNITION REQUEST RECEIVED ====");

        console.log("➡️ Raw body:", req.body);

        if (req.body.data) {
            console.log("➡️ Received data JSON string:", req.body.data);
        }

        console.log("➡️ Uploaded files:", req.files);

        console.log("➡️ Request headers:", req.headers);

        let dataArray = [];
        if (req.body.data) {
            try {
                dataArray = JSON.parse(req.body.data);
                console.log("✅ Parsed data array:", dataArray);
            } catch (e) {
                console.error("❌ Error parsing data JSON:", e.message);
                return res.status(400).json({ success: false, error: "Invalid JSON in data field" });
            }
        }

        const data = dataArray[0] || {};
        console.log("✅ Final parsed data object:", data);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const files = req.files || {};

        const originPicUrl = files.originPic ? `${baseUrl}/uploads/${files.originPic[0].filename}` : null;
        const bodyPicUrl = files.bodyPic ? `${baseUrl}/uploads/${files.bodyPic[0].filename}` : null;
        const facePicUrl = files.facePic ? `${baseUrl}/uploads/${files.facePic[0].filename}` : null;

        if (!data.personId || !data.name) {
            console.log("⚠️ Face NOT recognized. Saving unrecognized result.");

            latestRecognition = {
                recognized: false,
                message: "No user match",
                timestamp: new Date().toISOString(),
                deviceInfo: {
                    deviceIp: data.deviceIp || null,
                    deviceName: data.deviceName || null,
                    deviceNo: data.deviceNo || null,
                    captureTime: data.captureTime || null,
                    trackId: data.trackId || null
                },
                images: {
                    originPic: originPicUrl,
                    bodyPic: bodyPicUrl,
                    facePic: facePicUrl
                },
                rawData: data
            };

            console.log("✅ Saved unrecognized data:", latestRecognition);
            return res.json({ success: true, recognized: false, message: "No user match" });
        }

        console.log("✅ Face recognized:", data.name);

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
                originPic: originPicUrl,
                bodyPic: bodyPicUrl,
                facePic: facePicUrl,
                capturePic: data.capturePic || null
            },
            metadata: {
                tenantId: data.tenantId,
                captureId: data.captureId,
                deviceId: data.deviceId,
                recogDeviceId: data.recogDeviceId,
                recogDeviceNo: data.recogDeviceNo,
                trackId: data.trackId,
                sceneCode: data.sceneCode
            },
            bodyInfo: {
                gender: data.gender,
                age: data.age,
                upperColor: data.upperColor,
                upperType: data.upperType,
                bottomColor: data.bottomColor,
                bottomType: data.bottomType,
                hair: data.hair,
                hat: data.hat,
                hatColor: data.hatColor,
                glasses: data.glassess,
                mask: data.mask
            },
            rawData: data
        };

        console.log("✅ Saved recognized data:", latestRecognition);

        return res.json({ success: true, recognized: true, name: data.name });

    } catch (error) {
        console.error("🔥 SERVER ERROR:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});


app.get('/api/face-recognition/latest', (req, res) => {
    res.json(latestRecognition);
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/api/images', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const images = files.map(file => ({
            filename: file,
            url: `${baseUrl}/uploads/${file}`,
            uploadedAt: fs.statSync(path.join(uploadsDir, file)).mtime
        }));

        res.json({ success: true, images });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/images/cleanup', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        let deleted = 0;

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        });

        res.json({ success: true, message: `Deleted ${deleted} old images` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
