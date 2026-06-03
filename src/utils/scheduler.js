const MeetingRequest = require('../models/MeetingRequest');
const MeetingRegistration = require('../models/MeetingRegistration');
const Student = require('../models/Student');
const emailService = require('./emailService');

const runSchedulerJob = async () => {
    try {
        const now = new Date();
        console.log(`[Scheduler] Executing scheduled maintenance cycle at ${now.toISOString()}`);

        // 1. Auto-expiry: Mark meetings as COMPLETED when endTime has passed
        const expiredMeetings = await MeetingRequest.find({
            status: 'APPROVED',
            endTime: { $lt: now }
        });

        for (const meeting of expiredMeetings) {
            meeting.status = 'COMPLETED';
            await meeting.save();
            console.log(`[Scheduler] Marked meeting ${meeting._id} as COMPLETED`);

            // 2. Mark unattended registrations as MISSED
            const updatedRegs = await MeetingRegistration.updateMany(
                { meetingId: meeting._id, status: 'REGISTERED' },
                { $set: { status: 'MISSED' } }
            );
            console.log(`[Scheduler] Marked ${updatedRegs.modifiedCount} registrations as MISSED`);
        }

        // 3. Upcoming reminders: Meetings starting in next 15 minutes
        const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60 * 1000);
        const upcomingMeetings = await MeetingRequest.find({
            status: 'APPROVED',
            startTime: { $gte: now, $lte: fifteenMinsFromNow },
            reminderSent: false
        });

        for (const meeting of upcomingMeetings) {
            meeting.reminderSent = true;
            await meeting.save();

            // Get host email
            if (meeting.hostUserId) {
                const host = await Student.findById(meeting.hostUserId);
                if (host) {
                    try {
                        await emailService.sendMeetingReminderEmail(
                            host.name || 'Host',
                            host.email_id,
                            `${meeting.collegeName} (${meeting.branchName}) Group Session`,
                            meeting.startTime,
                            meeting.meetingLink
                        );
                    } catch (e) {
                        console.error('[Scheduler] Failed to send host reminder:', e);
                    }
                }
            }

            // Get registered users emails
            const registrations = await MeetingRegistration.find({
                meetingId: meeting._id,
                status: 'REGISTERED'
            }).populate('userId');

            for (const reg of registrations) {
                if (reg.userId && typeof reg.userId === 'object') {
                    try {
                        await emailService.sendMeetingReminderEmail(
                            reg.userId.name || 'Student',
                            reg.userId.email_id,
                            `${meeting.collegeName} (${meeting.branchName}) Group Session`,
                            meeting.startTime,
                            meeting.meetingLink
                        );
                    } catch (e) {
                        console.error('[Scheduler] Failed to send attendee reminder:', e);
                    }
                }
            }
            console.log(`[Scheduler] Dispatched reminders for meeting ${meeting._id}`);
        }

        return { success: true, timestamp: now };
    } catch (err) {
        console.error('[Scheduler] Error in scheduler cycle:', err);
        throw err;
    }
};

module.exports = { runSchedulerJob };
