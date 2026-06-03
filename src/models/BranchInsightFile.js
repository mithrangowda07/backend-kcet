const mongoose = require('mongoose');

const branchInsightFileSchema = new mongoose.Schema({
    college: { type: String, ref: 'College', required: true },
    branch: { type: String, ref: 'Branch', required: true },
    s3_url: { type: String, required: true },
    s3_key: { type: String, required: true },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    original_filename: { type: String, default: '' },
    file_size: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'uploaded_at', updatedAt: false } });

// Simulating unique_active_insight_per_branch
branchInsightFileSchema.index({ branch: 1 }, { unique: true, partialFilterExpression: { is_active: true } });

module.exports = mongoose.model('BranchInsightFile', branchInsightFileSchema);
