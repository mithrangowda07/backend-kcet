const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const authMiddleware = require('../middlewares/auth');

router.post('/login/', authController.login);
router.post('/register/counselling/', authController.registerCounselling);
router.post('/register/studying/', authController.registerStudying);
router.post('/refresh/', authController.refresh);

// Legacy endpoint mapping
router.post('/register/', authController.registerCounselling);

router.get('/me/', authMiddleware, studentController.me);
router.patch('/profile/', authMiddleware, studentController.updateProfile);

module.exports = router;
