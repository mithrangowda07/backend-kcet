const mongoose = require('mongoose');

const counsellingChoiceSchema = new mongoose.Schema({
    student_user_id: { type: String, ref: 'Student', required: true },
    order_of_list: { type: Number, required: true },
    unique_key: { type: String, ref: 'Branch', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Enforce uniqueness similarly to Django's unique_together
counsellingChoiceSchema.index({ student_user_id: 1, order_of_list: 1 }, { unique: true });
counsellingChoiceSchema.index({ student_user_id: 1, unique_key: 1 }, { unique: true });

module.exports = mongoose.model('CounsellingChoice', counsellingChoiceSchema);
