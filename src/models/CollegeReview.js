const mongoose = require('mongoose');

const collegeReviewSchema = new mongoose.Schema({
    student_user_id: { type: String, ref: 'Student', required: true },
    unique_key: { type: String, ref: 'Branch', required: true },
    review_date: { type: Date, default: Date.now },
    
    // Rating fields
    teaching_rating: { type: Number, required: true, min: 1, max: 5 },
    courses_rating: { type: Number, required: true, min: 1, max: 5 },
    library_rating: { type: Number, required: true, min: 1, max: 5 },
    research_rating: { type: Number, required: true, min: 1, max: 5 },
    internship_rating: { type: Number, required: true, min: 1, max: 5 },
    infrastructure_rating: { type: Number, required: true, min: 1, max: 5 },
    administration_rating: { type: Number, required: true, min: 1, max: 5 },
    extracurricular_rating: { type: Number, required: true, min: 1, max: 5 },
    safety_rating: { type: Number, required: true, min: 1, max: 5 },
    placement_rating: { type: Number, required: true, min: 1, max: 5 },
    
    // Review text fields
    teaching_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    courses_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    library_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    research_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    internship_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    infrastructure_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    administration_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    extracurricular_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    safety_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    placement_review: { type: String, required: true, minlength: 75, maxlength: 1000 },
    
    preferred_day: { type: String, default: '' },
    preferred_time: { type: String, default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

collegeReviewSchema.index({ student_user_id: 1, unique_key: 1 }, { unique: true });

module.exports = mongoose.model('CollegeReview', collegeReviewSchema);
