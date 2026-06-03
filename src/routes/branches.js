const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/collegeController');

router.get('/by-code/:college_code/', collegeController.getBranchesByCollegeCode);
router.get('/:public_id/', collegeController.getBranchDetail);
router.get('/:public_id/cutoff/', collegeController.getBranchCutoff);

module.exports = router;
