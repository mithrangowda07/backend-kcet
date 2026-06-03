const mongoose = require('mongoose');

const studentVerificationSchema = new mongoose.Schema({
    college_name: { type: String, required: true },
    student_name: { type: String, required: true },
    usn: { type: String, required: true },
    id_image_url: { type: String, required: true }, // Replaces BinaryField
    college_score: { type: Number, required: true },
    name_score: { type: Number, required: true },
    usn_score: { type: Number, required: true },
    verified: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('StudentVerification', studentVerificationSchema);
