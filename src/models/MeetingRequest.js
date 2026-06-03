const mongoose = require('mongoose');

const meetingRequestSchema = new mongoose.Schema({
  hostUserId: { type: String, ref: 'Student', default: null },
  createdByRole: {
    type: String,
    enum: ["STUDENT", "ADMIN"],
    required: true
  },

  collegeName: { type: String, required: true },
  branchName: { type: String, required: true },

  currentYear: { type: String, required: true },

  admissionType: {
    type: String,
    enum: ["KCET", "COMEDK", "Management"],
    required: true
  },

  kcetRank: { type: Number, required: true },

  languages: [{ type: String }],

  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },

  registrationDeadline: { type: Date, required: true },

  meetingCapacity: {
    type: Number,
    enum: [25, 50, 75, 100],
    default: 25
  },

  registeredCount: {
    type: Number,
    default: 0
  },

  tags: [{ type: String }],

  verificationBadge: { type: String, required: true },

  question1: { type: String, default: '' },
  question2: { type: String, default: '' },
  question3: { type: String, default: '' },
  question4: { type: String, default: '' },

  meetingLink: { type: String, default: '' },

  status: {
    type: String,
    enum: [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED"
    ],
    default: "PENDING"
  },

  rejectionReason: { type: String, default: '' },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },

  approvedAt: { type: Date, default: null },

  reminderSent: { type: Boolean, default: false }
}, { 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

module.exports = mongoose.model('MeetingRequest', meetingRequestSchema);
