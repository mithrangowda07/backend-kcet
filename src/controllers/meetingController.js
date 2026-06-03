const MeetingRequest = require('../models/MeetingRequest');
const MeetingRegistration = require('../models/MeetingRegistration');
const Student = require('../models/Student');
const emailService = require('../utils/emailService');

// POST /api/meetings/request/
const createStudentMeeting = async (req, res) => {
  try {
    const student = req.user;
    if (!student || student.type_of_student !== 'studying') {
      return res.status(403).json({ error: 'Only studying students can create meeting requests' });
    }

    const {
      currentYear,
      admissionType,
      languages,
      startTime,
      endTime,
      meetingCapacity,
      question1,
      question2,
      question3,
      question4
    } = req.body;

    // All fields are compulsory
    if (!currentYear || !admissionType || !languages || !startTime || !endTime || !meetingCapacity || !question1 || !question2 || !question3 || !question4) {
      return res.status(400).json({ error: 'All fields are compulsory' });
    }

    // Timing validations
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid dates provided' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Current Year Validation
    const startYear = student.year_of_starting;
    if (!startYear) {
      return res.status(400).json({ error: 'Your admission start year is not set in your profile' });
    }
    const currentYearNum = new Date().getFullYear();
    const maxAllowedYear = currentYearNum - startYear + 1;

    const yearTextToNum = {
      "1st Year": 1,
      "2nd Year": 2,
      "3rd Year": 3,
      "4th Year": 4
    };
    const selectedYearNum = yearTextToNum[currentYear] || 0;
    if (selectedYearNum <= 0) {
      return res.status(400).json({ error: 'Invalid current year selection' });
    }
    if (selectedYearNum > maxAllowedYear) {
      return res.status(400).json({ error: `Invalid year selection: Based on your starting year ${startYear}, you can only be maximum ${maxAllowedYear}th Year.` });
    }

    // Duplicate meeting check: max 1 meeting per day
    const startOfRequestedDay = new Date(startTime);
    startOfRequestedDay.setHours(0, 0, 0, 0);
    const endOfRequestedDay = new Date(startTime);
    endOfRequestedDay.setHours(23, 59, 59, 999);

    const duplicate = await MeetingRequest.findOne({
      hostUserId: student._id,
      createdByRole: 'STUDENT',
      startTime: { $gte: startOfRequestedDay, $lte: endOfRequestedDay }
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Duplicate meeting: You can host at most 1 meeting per day' });
    }

    // Generate dynamic badge and tags
    const collegeCode = student.college_code || 'COLLEGE';
    const branchCode = student.unique_key_data?.branch_id || 'BRANCH';
    const verificationBadge = `Verified ${collegeCode} ${branchCode} ${currentYear}`;
    const tags = [admissionType, collegeCode, branchCode];

    // Compute deadline
    const registrationDeadline = new Date(start.getTime() - 10 * 60 * 1000);

    // Auto-fill fields from profile
    const collegeName = student.unique_key_data?.college?.college_name || 'N/A';
    const branchName = student.unique_key_data?.branch_name || 'N/A';
    const kcetRank = student.kcet_rank || 0;

    const meeting = new MeetingRequest({
      hostUserId: student._id,
      createdByRole: 'STUDENT',
      collegeName,
      branchName,
      currentYear,
      admissionType,
      kcetRank,
      languages,
      startTime: start,
      endTime: end,
      registrationDeadline,
      meetingCapacity,
      tags,
      verificationBadge,
      question1,
      question2,
      question3,
      question4,
      status: 'PENDING'
    });

    await meeting.save();
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creating meeting request:', error);
    res.status(500).json({ error: 'Server error creating meeting request' });
  }
};

// GET /api/meetings/approved/
const getApprovedMeetings = async (req, res) => {
  try {
    const meetings = await MeetingRequest.find({ status: 'APPROVED' })
      .populate({ path: 'hostUserId', select: 'name email_id phone_number college_code unique_key' })
      .sort({ startTime: 1 });
    res.json(meetings);
  } catch (error) {
    console.error('Error getting approved meetings:', error);
    res.status(500).json({ error: 'Server error fetching approved meetings' });
  }
};

// POST /api/meetings/:id/register/
const registerForMeeting = async (req, res) => {
  try {
    const student = req.user;
    if (!student || student.type_of_student !== 'counselling') {
      return res.status(403).json({ error: 'Only counselling students can register for meetings' });
    }

    const meeting = await MeetingRequest.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Can only register for approved meetings' });
    }

    // Check deadline
    if (new Date() >= new Date(meeting.registrationDeadline)) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // Check capacity
    if (meeting.registeredCount >= meeting.meetingCapacity) {
      return res.status(400).json({ error: 'Meeting is already at full capacity' });
    }

    // Check if already registered
    const existingReg = await MeetingRegistration.findOne({
      meetingId: meeting._id,
      userId: student._id
    });
    if (existingReg && existingReg.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'You are already registered for this meeting' });
    }

    // Register user
    if (existingReg && existingReg.status === 'CANCELLED') {
      existingReg.status = 'REGISTERED';
      existingReg.registeredAt = new Date();
      await existingReg.save();
    } else {
      const reg = new MeetingRegistration({
        meetingId: meeting._id,
        userId: student._id,
        status: 'REGISTERED'
      });
      await reg.save();
    }

    // Increment count atomically
    meeting.registeredCount += 1;
    await meeting.save();

    // Send successful registration email
    try {
      await emailService.sendMeetingRegistrationSuccessEmail(
        student.name || 'Student',
        student.email_id,
        `${meeting.collegeName} (${meeting.branchName}) Group Session`,
        meeting.startTime
      );
    } catch (err) {
      console.error('Failed to send registration email:', err);
    }

    res.json({ message: 'Registered successfully', meeting });
  } catch (error) {
    console.error('Error registering for meeting:', error);
    res.status(500).json({ error: 'Server error registering for meeting' });
  }
};

// GET /api/meetings/registered/
const getRegisteredMeetings = async (req, res) => {
  try {
    const student = req.user;
    const registrations = await MeetingRegistration.find({
      userId: student._id,
      status: { $in: ['REGISTERED', 'ATTENDED'] }
    }).populate({
      path: 'meetingId',
      populate: {
        path: 'hostUserId',
        select: 'name email_id phone_number college_code'
      }
    });

    res.json(registrations.map(r => r.meetingId).filter(Boolean));
  } catch (error) {
    console.error('Error fetching registered meetings:', error);
    res.status(500).json({ error: 'Server error fetching registered meetings' });
  }
};

// POST /api/meetings/:id/join/
const joinMeeting = async (req, res) => {
  try {
    const student = req.user;
    const meeting = await MeetingRequest.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Verify user is either host or registered student
    const isHost = meeting.hostUserId === student._id;
    let registration = null;
    if (!isHost) {
      registration = await MeetingRegistration.findOne({
        meetingId: meeting._id,
        userId: student._id,
        status: 'REGISTERED'
      });
      if (!registration) {
        return res.status(403).json({ error: 'Only the host or registered students can join this meeting' });
      }
    }

    // Timing check: starting 10 mins before startTime, and before endTime
    const now = new Date();
    const allowedTime = new Date(new Date(meeting.startTime).getTime() - 10 * 60 * 1000);
    const endTime = new Date(meeting.endTime);

    if (now < allowedTime) {
      return res.status(400).json({ error: 'You can only join starting 10 minutes before the scheduled time' });
    }
    if (now > endTime) {
      return res.status(400).json({ error: 'This meeting has already ended' });
    }

    // Update status to ATTENDED if it was counselling student
    if (registration) {
      registration.status = 'ATTENDED';
      await registration.save();
    }

    res.json({ meetingLink: meeting.meetingLink });
  } catch (error) {
    console.error('Error joining meeting:', error);
    res.status(500).json({ error: 'Server error joining meeting' });
  }
};

// --- ADMIN CONTROLLERS ---

// GET /api/meetings/admin/pending/
const adminGetPendingMeetings = async (req, res) => {
  try {
    const meetings = await MeetingRequest.find({ status: 'PENDING' })
      .populate({ path: 'hostUserId', select: 'name email_id phone_number college_code unique_key' })
      .sort({ createdAt: -1 });
    res.json(meetings);
  } catch (error) {
    console.error('Error getting pending meetings:', error);
    res.status(500).json({ error: 'Server error fetching pending meetings' });
  }
};

// POST /api/meetings/admin/:id/approve/
const adminApproveMeeting = async (req, res) => {
  try {
    const { meetingCapacity, meetingLink } = req.body;
    if (!meetingCapacity || !meetingLink) {
      return res.status(400).json({ error: 'Meeting capacity and meeting link are required' });
    }

    const meeting = await MeetingRequest.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending requests can be approved' });
    }

    meeting.meetingCapacity = meetingCapacity;
    meeting.meetingLink = meetingLink;
    meeting.status = 'APPROVED';
    meeting.approvedBy = req.admin._id;
    meeting.approvedAt = new Date();

    await meeting.save();

    // Fetch host email
    const host = await Student.findById(meeting.hostUserId);
    if (host) {
      try {
        await emailService.sendMeetingApprovedEmail(
          host.name || 'Student',
          host.email_id,
          `${meeting.collegeName} (${meeting.branchName}) Group Session`,
          meeting.startTime
        );
      } catch (err) {
        console.error('Failed to send approval email:', err);
      }
    }

    res.json(meeting);
  } catch (error) {
    console.error('Error approving meeting:', error);
    res.status(500).json({ error: 'Server error approving meeting' });
  }
};

// POST /api/meetings/admin/:id/reject/
const adminRejectMeeting = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const meeting = await MeetingRequest.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending requests can be rejected' });
    }

    meeting.rejectionReason = rejectionReason;
    meeting.status = 'REJECTED';
    await meeting.save();

    // Fetch host email
    const host = await Student.findById(meeting.hostUserId);
    if (host) {
      try {
        await emailService.sendMeetingRejectedEmail(
          host.name || 'Student',
          host.email_id,
          rejectionReason
        );
      } catch (err) {
        console.error('Failed to send rejection email:', err);
      }
    }

    res.json(meeting);
  } catch (error) {
    console.error('Error rejecting meeting:', error);
    res.status(500).json({ error: 'Server error rejecting meeting' });
  }
};

// POST /api/meetings/admin/create/
const adminCreateMeeting = async (req, res) => {
  try {
    const {
      collegeFocus,
      branchFocus,
      admissionTypeFocus,
      meetingCapacity,
      startTime,
      endTime,
      meetingLink,
      tags
    } = req.body;

    if (!collegeFocus || !branchFocus || !admissionTypeFocus || !meetingCapacity || !startTime || !endTime || !meetingLink) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Set registration deadline
    const registrationDeadline = new Date(start.getTime() - 10 * 60 * 1000);

    // Build tags
    const meetingTags = [admissionTypeFocus, collegeFocus, branchFocus, ...(tags || [])];

    // Build verification badge
    const verificationBadge = `Verified Admin ${collegeFocus} ${branchFocus}`;

    const meeting = new MeetingRequest({
      createdByRole: 'ADMIN',
      collegeName: collegeFocus,
      branchName: branchFocus,
      currentYear: 'N/A',
      admissionType: admissionTypeFocus,
      kcetRank: 0,
      languages: ['English'],
      startTime: start,
      endTime: end,
      registrationDeadline,
      meetingCapacity,
      tags: meetingTags,
      verificationBadge,
      meetingLink,
      status: 'APPROVED',
      approvedBy: req.admin._id,
      approvedAt: new Date()
    });

    await meeting.save();
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error directly creating admin meeting:', error);
    res.status(500).json({ error: 'Server error creating admin meeting' });
  }
};

// GET /api/meetings/admin/history/
const adminGetMeetingHistory = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { status: status || { $in: ['APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'] } };
    const meetings = await MeetingRequest.find(filter)
      .populate({ path: 'hostUserId', select: 'name email_id phone_number college_code' })
      .sort({ startTime: -1 });
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching admin meeting history:', error);
    res.status(500).json({ error: 'Server error fetching meeting history' });
  }
};

const getHostMeetings = async (req, res) => {
  try {
    const student = req.user;
    if (!student || student.type_of_student !== 'studying') {
      return res.status(403).json({ error: 'Only studying students can fetch hosted meetings' });
    }
    const meetings = await MeetingRequest.find({ hostUserId: student._id }).sort({ startTime: -1 });
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching host meetings:', error);
    res.status(500).json({ error: 'Server error fetching hosted meetings' });
  }
};

module.exports = {
  createStudentMeeting,
  getApprovedMeetings,
  registerForMeeting,
  getRegisteredMeetings,
  joinMeeting,
  getHostMeetings,
  adminGetPendingMeetings,
  adminApproveMeeting,
  adminRejectMeeting,
  adminCreateMeeting,
  adminGetMeetingHistory
};
