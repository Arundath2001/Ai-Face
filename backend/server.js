// backend/server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// --- logging without consuming body ---
app.use((req, res, next) => {
    console.log('🔥 HIT:', req.method, req.url);
    console.log('🔵 HEADERS:', req.headers);
    next();
});

// static paths
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// middleware
app.use(cors());
app.use(express.json()); // OK for non-multipart
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(frontendDist));

// health
app.get('/health', (req, res) => res.send('OK'));

// in-memory latest record
let latestRecognition = {
    recognized: false,
    message: 'Waiting for first recognition...',
    timestamp: new Date().toISOString(),
};

// (optional) quick pre-log for that route without touching body
app.post('/api/face-recognition', (req, res, next) => {
    console.log('➡️  /api/face-recognition hit');
    next();
});

// accept any multipart fields so we’re tolerant of device formats
app.post('/api/face-recognition', upload.any(), (req, res) => {
    try {
        console.log('📦 FILES:', req.files?.map(f => ({ field: f.fieldname, name: f.originalname, saved: f.filename })));
        console.log('📄 FIELDS:', req.body);

        // Try to read your JSON payload
        // Device often sends a field like "data" or "json"
        let dataArray = [];
        if (req.body.data) {
            try { dataArray = JSON.parse(req.body.data); }
            catch (e) { return res.status(400).json({ success: false, error: 'Invalid JSON in data field' }); }
        } else if (req.body.json) {
            try { dataArray = JSON.parse(req.body.json); }
            catch (e) { return res.status(400).json({ success: false, error: 'Invalid JSON in json field' }); }
        }

        const data = Array.isArray(dataArray) ? (dataArray[0] || {}) : (req.body || {});
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // find files by common fieldnames; fall back to first/any
        const byName = name => (req.files || []).find(f => f.fieldname === name);
        const firstFile = (req.files || [])[0];

        const origin = byName('originPic') || byName('origin') || null;
        const body = byName('bodyPic') || byName('body') || null;
        const face = byName('facePic') || byName('face') || firstFile || null;

        const urlOrNull = f => (f ? `${baseUrl}/uploads/${f.filename}` : null);

        // if not recognized
        if (!data.personId || !data.name) {
            latestRecognition = {
                recognized: false,
                message: 'No user match',
                timestamp: new Date().toISOString(),
                deviceInfo: {
                    deviceIp: data.deviceIp || null,
                    deviceName: data.deviceName || null,
                    deviceNo: data.deviceNo || null,
                    captureTime: data.captureTime || null,
                    trackId: data.trackId || null,
                },
                images: {
                    originPic: urlOrNull(origin),
                    bodyPic: urlOrNull(body),
                    facePic: urlOrNull(face),
                },
                rawData: data,
            };
            console.log('💾 Saved UNRECOGNIZED');
            return res.json({ success: true, recognized: false });
        }

        // recognized
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
                facePic: urlOrNull(face),
                capturePic: data.capturePic || null,
            },
            metadata: {
                tenantId: data.tenantId,
                captureId: data.captureId,
                deviceId: data.deviceId,
                recogDeviceId: data.recogDeviceId,
                recogDeviceNo: data.recogDeviceNo,
                trackId: data.trackId,
                sceneCode: data.sceneCode,
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
                mask: data.mask,
            },
            rawData: data,
        };
        console.log('💾 Saved RECOGNIZED');
        res.json({ success: true, recognized: true, name: data.name });
    } catch (err) {
        console.error('SERVER ERROR:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/face-recognition/latest', (req, res) => {
    res.json(latestRecognition);
});

// serve SPA
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
