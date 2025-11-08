const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

/************************************************
 * GLOBAL LOGGER (works for all request types)
 ************************************************/
app.use((req, res, next) => {
    console.log("🔵 HIT:", req.method, req.url);
    console.log("🔵 HEADERS:", req.headers);
    next();
});

/************************************************
 * IMPORTANT: RAW BINARY HANDLER FOR AI BOX
 ************************************************/
app.use('/api/face-recognition', express.raw({
    type: '*/*',
    limit: '50mb'
}));

/************************************************
 * STATIC & BODY PARSERS (used for non-binary)
 ************************************************/
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/************************************************
 * FILE STORAGE (for multipart mode / Postman)
 ************************************************/
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }
});

/************************************************
 * RECOGNITION DATA CACHE
 ************************************************/
let latestRecognition = {
    recognized: false,
    message: "Waiting for first recognition...",
    timestamp: new Date().toISOString()
};

/************************************************
 * MAIN FACE RECOGNITION ENDPOINT
 ************************************************/
app.post('/api/face-recognition', (req, res, next) => {

    const contentType = req.headers['content-type'];

    // ✅ CASE 1: DEVICE SENT BINARY STREAM
    if (contentType && contentType.includes('application/octet-stream')) {
        console.log("🟡 BINARY MODE DETECTED");

        const rawBuffer = req.body;
        console.log("🟡 BINARY SIZE:", rawBuffer.length);

        const filename = `ffbox-${Date.now()}.bin`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, rawBuffer);

        latestRecognition = {
            type: "binary",
            receivedAt: new Date().toISOString(),
            file: `/uploads/${filename}`,
            size: rawBuffer.length
        };

        console.log("🟡 SAVED BINARY PAYLOAD:", filePath);

        return res.json({ success: true, mode: "binary" });
    }

    next(); // Continue to multipart mode
});

/************************************************
 * MULTIPART HANDLER (Postman tests)
 ************************************************/
app.post('/api/face-recognition',
    upload.fields([
        { name: 'originPic', maxCount: 1 },
        { name: 'bodyPic', maxCount: 1 },
        { name: 'facePic', maxCount: 1 }
    ]),
    (req, res) => {

        console.log("🟢 MULTIPART MODE DETECTED");
        console.log("Body:", req.body);
        console.log("Files:", req.files);

        let parsedData = {};
        if (req.body.data) {
            try {
                parsedData = JSON.parse(req.body.data)[0] || {};
            } catch (err) {
                return res.status(400).json({ error: "Invalid JSON in data" });
            }
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const files = req.files || {};

        const originPicUrl = files.originPic ? `${baseUrl}/uploads/${files.originPic[0].filename}` : null;
        const bodyPicUrl = files.bodyPic ? `${baseUrl}/uploads/${files.bodyPic[0].filename}` : null;
        const facePicUrl = files.facePic ? `${baseUrl}/uploads/${files.facePic[0].filename}` : null;

        latestRecognition = {
            mode: "multipart",
            timestamp: new Date().toISOString(),
            data: parsedData,
            images: {
                originPic: originPicUrl,
                bodyPic: bodyPicUrl,
                facePic: facePicUrl
            }
        };

        return res.json({ success: true, recognized: !!parsedData.personId });
    }
);

/************************************************
 * GET LATEST DATA
 ************************************************/
app.get('/api/face-recognition/latest', (req, res) => {
    res.json(latestRecognition);
});

/************************************************
 * FRONTEND BUILD SERVING
 ************************************************/
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(frontendDist));

app.use((req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
});

/************************************************
 * START SERVER
 ************************************************/
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
