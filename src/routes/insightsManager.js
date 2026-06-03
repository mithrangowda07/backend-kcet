const express = require('express');
const router = express.Router();
const insightsManagerController = require('../controllers/insightsManagerController');
const adminAuthMiddleware = require('../middlewares/adminAuth');
const upload = require('../middlewares/upload');

// Public endpoints
router.post('/login/', insightsManagerController.adminLogin);
router.get('/branch-insights/:branch_id/', insightsManagerController.getBranchInsight);

// Protected endpoints
router.use(adminAuthMiddleware);

router.get('/me/', insightsManagerController.adminMe);
router.get('/colleges/', insightsManagerController.adminCollegeList);
router.get('/colleges/:college_id/branches/', insightsManagerController.adminBranchesByCollege);
router.post('/branch-insights/upload/', upload.single('json_file'), insightsManagerController.adminUploadBranchInsight);

router.get('/students/', insightsManagerController.adminStudentList);
router.get('/students/:student_id/', insightsManagerController.adminStudentDetail);
router.post('/students/:student_id/approve/', insightsManagerController.adminStudentApprove);
router.post('/students/:student_id/reject/', insightsManagerController.adminStudentReject);

module.exports = router;
