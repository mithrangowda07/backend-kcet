const mongoose = require('mongoose');

const meetingRegistrationSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRequest', required: true },
  userId: { type: String, ref: 'Student', required: true },

  status: {
    type: String,
    enum: [
      "REGISTERED",
      "ATTENDED",
      "MISSED",
      "CANCELLED"
    ],
    default: "REGISTERED"
  },

  registeredAt: { type: Date, default: Date.now }
}, { 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure a user can only register once per meeting
meetingRegistrationSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MeetingRegistration', meetingRegistrationSchema);
