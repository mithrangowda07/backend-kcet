const mongoose = require('mongoose');

const adminAccountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('AdminAccount', adminAccountSchema);
