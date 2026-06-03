const CollegeReview = require('../models/CollegeReview');
const Branch = require('../models/Branch');
const College = require('../models/College');

// POST /api/review/
const reviewCreate = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'studying') {
            return res.status(403).json({ error: 'Only studying students can create reviews' });
        }

        const branchId = student.unique_key;
        if (!branchId) {
            return res.status(400).json({ error: 'Your profile is missing a branch. Please contact support.' });
        }

        // Validate character lengths for every review point
        const REVIEW_FIELDS = [
            'teaching_review', 'courses_review', 'library_review', 'research_review',
            'internship_review', 'infrastructure_review', 'administration_review',
            'extracurricular_review', 'safety_review', 'placement_review'
        ];

        for (const field of REVIEW_FIELDS) {
            const val = (req.body[field] || '').toString().trim();
            if (val.length < 75) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: `Review for ${field.replace('_review', '').replace('_', ' ')} must contain at least 75 characters.`
                });
            }
            if (val.length > 1000) {
                return res.status(400).json({
                    error: 'Validation failed',
                    message: `Review for ${field.replace('_review', '').replace('_', ' ')} cannot exceed 1000 characters.`
                });
            }
        }

        const payloadUniqueKey = req.body.unique_key;
        if (payloadUniqueKey && payloadUniqueKey !== branchId.toString()) {
            return res.status(400).json({ error: 'You can only review your own branch.' });
        }

        const existing = await CollegeReview.findOne({ student_user_id: student._id, unique_key: branchId });

        if (existing) {
            Object.keys(req.body).forEach(key => {
                if (key !== 'unique_key') {
                    existing[key] = req.body[key];
                }
            });
            await existing.save();
            return res.json(existing);
        }

        const { unique_key, ...reviewBody } = req.body;
        const review = new CollegeReview({
            student_user_id: student._id,
            ...reviewBody,
            unique_key: branchId,
        });
        await review.save();
        res.status(201).json(review);
    } catch (error) {
        console.error("Review create error:", error);
        res.status(400).json({ error: "Validation failed." });
    }
};

// GET /api/review/my-review/:unique_key/
const myReview = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'studying') {
            return res.status(403).json({ error: 'Only studying students can access reviews' });
        }

        const branchId = student.unique_key;
        if (!branchId) {
            return res.status(400).json({ error: 'Your profile is missing a branch. Please contact support.' });
        }

        if (req.params.unique_key && req.params.unique_key !== branchId.toString()) {
            return res.status(400).json({
                error: 'You can only access the review for your assigned branch.',
                branch: branchId
            });
        }

        const review = await CollegeReview.findOne({ student_user_id: student._id, unique_key: branchId });
        res.json(review ? review : { review: null });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// DELETE /api/review/my-review/:unique_key/delete/
const deleteMyReview = async (req, res) => {
    try {
        const student = req.user;
        if (student.type_of_student !== 'studying') {
            return res.status(403).json({ error: 'Only studying students can delete reviews' });
        }

        const branchId = student.unique_key;
        if (!branchId) return res.status(400).json({ error: 'Your profile is missing a branch.' });

        if (req.params.unique_key && req.params.unique_key !== branchId.toString()) {
            return res.status(400).json({ error: 'You can only delete the review for your assigned branch.', branch: branchId });
        }

        const review = await CollegeReview.findOneAndDelete({ student_user_id: student._id, unique_key: branchId });
        if (!review) return res.status(404).json({ error: 'Review not found' });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/review/branches/:public_id/
const branchReviews = async (req, res) => {
    try {
        const branch = await Branch.findOne({ public_id: req.params.public_id });
        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const reviews = await CollegeReview.find({ unique_key: branch._id }).populate('student_user_id');

        let avgRatings = {
            avg_teaching: null, avg_courses: null, avg_library: null, avg_research: null,
            avg_internship: null, avg_infrastructure: null, avg_administration: null,
            avg_extracurricular: null, avg_safety: null, avg_placement: null
        };

        if (reviews.length > 0) {
            const sum = {
                teaching: 0, courses: 0, library: 0, research: 0, internship: 0,
                infrastructure: 0, administration: 0, extracurricular: 0, safety: 0, placement: 0
            };
            let count = 0;
            reviews.forEach(r => {
                if (r.teaching_rating) {
                    sum.teaching += r.teaching_rating; sum.courses += r.courses_rating;
                    sum.library += r.library_rating; sum.research += r.research_rating;
                    sum.internship += r.internship_rating; sum.infrastructure += r.infrastructure_rating;
                    sum.administration += r.administration_rating; sum.extracurricular += r.extracurricular_rating;
                    sum.safety += r.safety_rating; sum.placement += r.placement_rating;
                    count++;
                }
            });
            if (count > 0) {
                avgRatings = {
                    avg_teaching: sum.teaching / count, avg_courses: sum.courses / count,
                    avg_library: sum.library / count, avg_research: sum.research / count,
                    avg_internship: sum.internship / count, avg_infrastructure: sum.infrastructure / count,
                    avg_administration: sum.administration / count, avg_extracurricular: sum.extracurricular / count,
                    avg_safety: sum.safety / count, avg_placement: sum.placement / count
                };
            }
        }

        res.json({
            reviews,
            average_ratings: avgRatings,
            total_reviews: reviews.length
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

// GET /api/review/colleges/:public_id/
const collegeReviews = async (req, res) => {
    try {
        const college = await College.findOne({ public_id: req.params.public_id });
        if (!college) return res.status(404).json({ error: 'College not found' });

        const branches = await Branch.find({ college: college._id });
        const branchIds = branches.map(b => b._id);
        const reviews = await CollegeReview.find({ unique_key: { $in: branchIds } }).populate('unique_key');

        const branch_reviews = {};
        branches.forEach(branch => {
            const branchReviewList = reviews.filter(r => r.unique_key && r.unique_key._id.toString() === branch._id.toString());
            if (branchReviewList.length > 0) {
                let sum = {
                    teaching: 0, courses: 0, library: 0, research: 0, internship: 0,
                    infrastructure: 0, administration: 0, extracurricular: 0, safety: 0, placement: 0
                };
                let count = 0;
                branchReviewList.forEach(r => {
                    if (r.teaching_rating) {
                        sum.teaching += r.teaching_rating; sum.courses += r.courses_rating;
                        sum.library += r.library_rating; sum.research += r.research_rating;
                        sum.internship += r.internship_rating; sum.infrastructure += r.infrastructure_rating;
                        sum.administration += r.administration_rating; sum.extracurricular += r.extracurricular_rating;
                        sum.safety += r.safety_rating; sum.placement += r.placement_rating;
                        count++;
                    }
                });
                branch_reviews[branch._id] = {
                    branch_name: branch.branch_name,
                    average_ratings: count > 0 ? {
                        avg_teaching: sum.teaching / count, avg_courses: sum.courses / count,
                        avg_library: sum.library / count, avg_research: sum.research / count,
                        avg_internship: sum.internship / count, avg_infrastructure: sum.infrastructure / count,
                        avg_administration: sum.administration / count, avg_extracurricular: sum.extracurricular / count,
                        avg_safety: sum.safety / count, avg_placement: sum.placement / count
                    } : {},
                    total_reviews: branchReviewList.length
                };
            }
        });

        let overallSum = {
            teaching: 0, courses: 0, library: 0, research: 0, internship: 0,
            infrastructure: 0, administration: 0, extracurricular: 0, safety: 0, placement: 0
        };
        let overallCount = 0;
        reviews.forEach(r => {
            if (r.teaching_rating) {
                overallSum.teaching += r.teaching_rating; overallSum.courses += r.courses_rating;
                overallSum.library += r.library_rating; overallSum.research += r.research_rating;
                overallSum.internship += r.internship_rating; overallSum.infrastructure += r.infrastructure_rating;
                overallSum.administration += r.administration_rating; overallSum.extracurricular += r.extracurricular_rating;
                overallSum.safety += r.safety_rating; overallSum.placement += r.placement_rating;
                overallCount++;
            }
        });

        res.json({
            college_id: college.public_id,
            college_name: college.college_name,
            branch_reviews,
            overall_average_ratings: overallCount > 0 ? {
                avg_teaching: overallSum.teaching / overallCount, avg_courses: overallSum.courses / overallCount,
                avg_library: overallSum.library / overallCount, avg_research: overallSum.research / overallCount,
                avg_internship: overallSum.internship / overallCount, avg_infrastructure: overallSum.infrastructure / overallCount,
                avg_administration: overallSum.administration / overallCount, avg_extracurricular: overallSum.extracurricular / overallCount,
                avg_safety: overallSum.safety / overallCount, avg_placement: overallSum.placement / overallCount
            } : {},
            total_reviews: reviews.length
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};

module.exports = {
    reviewCreate, myReview, deleteMyReview, branchReviews, collegeReviews
};
