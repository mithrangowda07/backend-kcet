const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/collegeController');

router.get('/', collegeController.getColleges);
router.get('/categories/', collegeController.categoryList);
router.get('/clusters/', collegeController.clusterList);
router.get('/search/', collegeController.search);
router.get('/locations/', collegeController.locationsList);
router.post('/branch-insights/', collegeController.branchInsights);
router.get('/:public_id/cutoff/', collegeController.getCollegeCutoff);
router.get('/:public_id/', collegeController.getCollegeDetail);

module.exports = router;
