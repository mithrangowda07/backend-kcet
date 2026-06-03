const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middlewares/auth');
const adminAuthMiddleware = require('../middlewares/adminAuth');

// --- STUDENT ENDPOINTS ---
router.post('/request/', authMiddleware, meetingController.createStudentMeeting);
router.get('/approved/', authMiddleware, meetingController.getApprovedMeetings);
router.post('/:id/register/', authMiddleware, meetingController.registerForMeeting);
router.get('/registered/', authMiddleware, meetingController.getRegisteredMeetings);
router.get('/host/', authMiddleware, meetingController.getHostMeetings);
router.post('/:id/join/', authMiddleware, meetingController.joinMeeting);

// --- ADMIN ENDPOINTS ---
router.get('/admin/pending/', adminAuthMiddleware, meetingController.adminGetPendingMeetings);
router.post('/admin/:id/approve/', adminAuthMiddleware, meetingController.adminApproveMeeting);
router.post('/admin/:id/reject/', adminAuthMiddleware, meetingController.adminRejectMeeting);
router.post('/admin/create/', adminAuthMiddleware, meetingController.adminCreateMeeting);
router.get('/admin/history/', adminAuthMiddleware, meetingController.adminGetMeetingHistory);

module.exports = router;
