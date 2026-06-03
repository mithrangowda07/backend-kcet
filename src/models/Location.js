const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    location_name: { type: String, required: true, unique: true }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('Location', locationSchema);
