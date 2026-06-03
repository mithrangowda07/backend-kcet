const multer = require('multer');

// Store files in memory so we can upload them directly to S3
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit as per Django STUDENT_ID_CARD_MAX_UPLOAD_BYTES
    },
});

module.exports = upload;
