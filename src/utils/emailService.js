let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch {
    nodemailer = null;
    console.warn('[email] nodemailer not installed. Run: npm install nodemailer');
}

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!nodemailer || !host || !user || !pass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass },
    });

    return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
    const mailer = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!mailer || !from) {
        console.log(`[EMAIL-MOCK] To: ${to} | Subject: ${subject}`);
        console.log(text);
        return { mocked: true };
    }

    await mailer.sendMail({ from, to, subject, text, html });
    return { sent: true };
};

const sendRegistrationApprovedEmail = async (studentName, recipient) => {
    const subject = 'KCET EduGuide – College student registration approved';
    const text = `Hello ${studentName || 'Student'},\n\nYour college student registration on KCET EduGuide has been approved. You can now log in with your email and password.\n\nThank you,\nKCET EduGuide Team`;

    return sendEmail({
        to: recipient,
        subject,
        text,
        html: `<p>Hello <strong>${studentName || 'Student'}</strong>,</p>
<p>Your college student registration on <strong>KCET EduGuide</strong> has been <strong>approved</strong>.</p>
<p>You can now log in with your email and password.</p>
<p>Thank you,<br/>KCET EduGuide Team</p>`,
    });
};

const sendRegistrationRejectedEmail = async (studentName, recipient, rejectionReason) => {
    const subject = 'KCET EduGuide – College student registration not approved';
    const text = `Hello ${studentName || 'Student'},\n\nYour college student registration was not approved.\n\nReason: ${rejectionReason}\n\nIf you believe this is an error, please contact support or register again with correct details.\n\nKCET EduGuide Team`;

    return sendEmail({
        to: recipient,
        subject,
        text,
        html: `<p>Hello <strong>${studentName || 'Student'}</strong>,</p>
<p>Your college student registration was <strong>not approved</strong>.</p>
<p><strong>Reason:</strong> ${rejectionReason}</p>
<p>If you believe this is an error, please contact support or register again with correct details.</p>
<p>KCET EduGuide Team</p>`,
    });
};

const sendMeetingApprovedEmail = async (hostName, recipientEmail, meetingTitle, startTime) => {
    const subject = 'KCET EduGuide – Meeting Request Approved';
    const text = `Hello ${hostName || 'Student'},\n\nYour meeting "${meetingTitle}" scheduled for ${new Date(startTime).toLocaleString()} has been approved by the Administrator.\n\nBest regards,\nKCET EduGuide Team`;
    
    return sendEmail({
        to: recipientEmail,
        subject,
        text,
        html: `<p>Hello <strong>${hostName || 'Student'}</strong>,</p>
<p>Your meeting request <strong>"${meetingTitle}"</strong> scheduled for ${new Date(startTime).toLocaleString()} has been <strong>approved</strong> by the Administrator.</p>
<p>Best regards,<br/>KCET EduGuide Team</p>`
    });
};

const sendMeetingRejectedEmail = async (hostName, recipientEmail, rejectionReason) => {
    const subject = 'KCET EduGuide – Meeting Request Not Approved';
    const text = `Hello ${hostName || 'Student'},\n\nYour meeting request was not approved.\n\nReason: ${rejectionReason}\n\nBest regards,\nKCET EduGuide Team`;

    return sendEmail({
        to: recipientEmail,
        subject,
        text,
        html: `<p>Hello <strong>${hostName || 'Student'}</strong>,</p>
<p>Your meeting request was <strong>not approved</strong>.</p>
<p><strong>Reason:</strong> ${rejectionReason}</p>
<p>Best regards,<br/>KCET EduGuide Team</p>`
    });
};

const sendMeetingRegistrationSuccessEmail = async (recipientName, recipientEmail, meetingTitle, startTime) => {
    const subject = 'KCET EduGuide – Successful Meeting Registration';
    const text = `Hello ${recipientName || 'Student'},\n\nYou have successfully registered for the meeting "${meetingTitle}" starting at ${new Date(startTime).toLocaleString()}.\n\nBest regards,\nKCET EduGuide Team`;

    return sendEmail({
        to: recipientEmail,
        subject,
        text,
        html: `<p>Hello <strong>${recipientName || 'Student'}</strong>,</p>
<p>You have successfully <strong>registered</strong> for the meeting <strong>"${meetingTitle}"</strong> starting at ${new Date(startTime).toLocaleString()}.</p>
<p>Best regards,<br/>KCET EduGuide Team</p>`
    });
};

const sendMeetingReminderEmail = async (recipientName, recipientEmail, meetingTitle, startTime, link) => {
    const subject = 'KCET EduGuide – Meeting Reminder';
    const text = `Hello ${recipientName || 'Student'},\n\nThis is a reminder that the meeting "${meetingTitle}" is starting soon at ${new Date(startTime).toLocaleString()}.\n\nJoin link: ${link || 'Will be active 10 minutes before the start time'}\n\nBest regards,\nKCET EduGuide Team`;

    return sendEmail({
        to: recipientEmail,
        subject,
        text,
        html: `<p>Hello <strong>${recipientName || 'Student'}</strong>,</p>
<p>This is a reminder that the meeting <strong>"${meetingTitle}"</strong> is starting soon at ${new Date(startTime).toLocaleString()}.</p>
<p><strong>Join link:</strong> <a href="${link}">${link}</a> (Note: The link is active 10 minutes before the start time)</p>
<p>Best regards,<br/>KCET EduGuide Team</p>`
    });
};

module.exports = {
    sendRegistrationApprovedEmail,
    sendRegistrationRejectedEmail,
    sendMeetingApprovedEmail,
    sendMeetingRejectedEmail,
    sendMeetingRegistrationSuccessEmail,
    sendMeetingReminderEmail,
};
