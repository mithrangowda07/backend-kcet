const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authMiddleware = require('../middlewares/auth');

router.get('/branches/:public_id/', reviewController.branchReviews);
router.get('/colleges/:public_id/', reviewController.collegeReviews);

// Endpoints below require authentication
router.use(authMiddleware);

router.post('/', reviewController.reviewCreate);
router.get('/my-review/:unique_key/', reviewController.myReview);
router.delete('/my-review/:unique_key/delete/', reviewController.deleteMyReview);

module.exports = router;
