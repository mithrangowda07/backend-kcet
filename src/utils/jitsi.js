const crypto = require('crypto');

const generateJitsiMeetingLink = (studyingUserId, counsellingUserId) => {
    const randomString = crypto.randomBytes(4).toString('hex');
    const meetingName = `kcet-eduguide-${studyingUserId}-${counsellingUserId}-${randomString}`;
    return `https://meet.jit.si/${meetingName}`;
};

module.exports = { generateJitsiMeetingLink };
