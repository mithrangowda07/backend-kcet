const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middlewares/auth');

router.post('/login/', authController.login);
router.post('/register/counselling/', authController.registerCounselling);
router.post('/register/studying/', authController.registerStudying);
router.post('/refresh/', authController.refresh);

router.post('/send-otp/', authController.sendOtp);
router.post('/verify-otp/', authController.verifyOtp);
router.post('/reset-password/', authController.resetPassword);
router.post('/change-password/', authMiddleware, authController.changePassword);

// Legacy endpoint mapping
router.post('/register/', authController.registerCounselling);

router.get('/me/', authMiddleware, studentController.me);
router.patch('/profile/', authMiddleware, studentController.updateProfile);

module.exports = router;
