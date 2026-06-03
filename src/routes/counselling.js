const express = require('express');
const router = express.Router();
const counsellingController = require('../controllers/counsellingController');
const authMiddleware = require('../middlewares/auth');

// All endpoints require authentication
router.use(authMiddleware);

router.post('/recommendations/', counsellingController.recommendations);
router.get('/choices/', counsellingController.choicesList);
router.get('/choices/:studentId', counsellingController.choicesList);
router.post('/choices/create/', counsellingController.choicesCreate);
router.patch('/choices/:choice_id/update/', counsellingController.choicesUpdate);
router.delete('/choices/:choice_id/delete/', counsellingController.choicesDelete);
router.post('/choices/bulk-update/', counsellingController.choicesBulkUpdate);

module.exports = router;
