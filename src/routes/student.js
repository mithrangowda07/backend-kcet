const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const upload = require('../middlewares/upload');

// POST /api/student/upload-id-card/
router.post('/upload-id-card/', upload.single('file'), studentController.uploadIdCard);

// POST /api/student/register/ maps to studying registration
router.post('/register/', authController.registerStudying);

module.exports = router;
