const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = file.originalname;
        cb(null, `${timestamp}-${originalName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

// In-memory storage for latest recognition data
let latestRecognition = {
    recognized: false,
    message: "Waiting for first recognition...",
    timestamp: new Date().toISOString()
};

// POST endpoint - Receives data from Four-Faith AI tool
app.post('/api/face-recognition', upload.fields([
    { name: 'originPic', maxCount: 1 },
    { name: 'bodyPic', maxCount: 1 },
    { name: 'facePic', maxCount: 1 }
]), (req, res) => {
    try {
        console.log('📥 Received POST request');
        console.log('Body:', req.body);
        console.log('Files:', req.files);

        // Parse the data field
        let dataArray = [];
        try {
            if (req.body.data) {
                dataArray = JSON.parse(req.body.data);
            }
        } catch (e) {
            console.error('JSON parse error:', e);
            return res.status(400).json({
                success: false,
                error: "Invalid JSON in data field"
            });
        }

        const data = dataArray[0] || {};

        // Build file URLs
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const files = req.files || {};

        const originPicUrl = files.originPic ? `${baseUrl}/uploads/${files.originPic[0].filename}` : null;
        const bodyPicUrl = files.bodyPic ? `${baseUrl}/uploads/${files.bodyPic[0].filename}` : null;
        const facePicUrl = files.facePic ? `${baseUrl}/uploads/${files.facePic[0].filename}` : null;

        // Check if person is recognized
        if (!data.personId || !data.name) {
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

            console.log('❌ Not recognized');
            return res.json({
                success: true,
                recognized: false,
                message: "No user match"
            });
        }

        // Person recognized
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

        console.log('✅ Person recognized:', data.name);
        res.json({
            success: true,
            recognized: true,
            name: data.name
        });

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET endpoint - Returns latest recognition data to frontend
app.get('/api/face-recognition/latest', (req, res) => {
    try {
        console.log('📤 GET request - sending latest data');
        res.json(latestRecognition);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get all stored images
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

// Clear old images (optional - clean up images older than 24 hours)
app.delete('/api/images/cleanup', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let deletedCount = 0;

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtime.getTime();

            if (age > maxAge) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });

        res.json({
            success: true,
            message: `Deleted ${deletedCount} old images`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 POST endpoint: http://localhost:${PORT}/api/face-recognition`);
    console.log(`📊 GET endpoint: http://localhost:${PORT}/api/face-recognition/latest`);
    console.log(`🖼️  Images served from: http://localhost:${PORT}/uploads/`);
});