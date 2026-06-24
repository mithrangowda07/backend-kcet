const Student = require('../models/Student');
const Branch = require('../models/Branch');
const College = require('../models/College');
const { verifyPassword, hashPassword } = require('../utils/hash');
const { validatePassword } = require('../utils/validation');
const jwt = require('jsonwebtoken');
const { generateTokens, generateTempToken, verifyTempToken, SECRET_KEY } = require('../utils/jwt');
const OTP = require('../models/OTP');
const {
    sendOtpRegistrationEmail,
    sendOtpForgotPasswordEmail,
    sendOtpChangePasswordEmail
} = require('../utils/emailService');
const bcrypt = require('bcryptjs');

// POST /api/auth/login/
const login = async (req, res) => {
    try {
        const { email_id, password } = req.body;
        
        if (!email_id || !password) {
            return res.status(400).json({ email_id: ["This field is required."], password: ["This field is required."] });
        }

        const student = await Student.findOne({ email_id: email_id.toLowerCase(), is_active: true });
        
        if (!student || !verifyPassword(password, student.hashed_password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (student.type_of_student === 'studying') {
            if (student.approval_status === 'PENDING') {
                return res.status(403).json({
                    error: 'Account pending approval',
                    message: 'Your registration is pending administrator approval. You will receive an email once your application has been reviewed.',
                    approval_status: student.approval_status,
                });
            }
            if (student.approval_status === 'REJECTED') {
                return res.status(403).json({
                    error: 'Registration rejected',
                    message: 'Your student registration was rejected.',
                    approval_status: student.approval_status,
                    rejection_reason: student.rejection_reason,
                });
            }
        }

        student.last_login = new Date();
        await student.save();
        await student.populate({ path: 'unique_key', populate: { path: 'college' } });

        const studentObj = student.toObject();
        const populatedBranch = studentObj.unique_key;
        studentObj.unique_key_data = populatedBranch;

        if (populatedBranch && typeof populatedBranch === 'object') {
            studentObj.unique_key = populatedBranch._id || populatedBranch.unique_key || studentObj.unique_key;
        }

        const tokens = generateTokens(student._id);

        res.json({
            student: studentObj,
            tokens: {
                refresh: tokens.refresh,
                access: tokens.access,
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during authentication" });
    }
};

// POST /api/auth/register/counselling/
const registerCounselling = async (req, res) => {
    try {
        const { email_id, phone_number, password, password_confirm, name, category, kcet_rank, email_verification_token } = req.body;
        const cleanEmail = (email_id || '').trim().toLowerCase();
        
        if (!cleanEmail || !password || !phone_number || !name?.trim()) {
            return res.status(400).json({ message: 'Name, email, phone number, and password are required.' });
        }

        if (!email_verification_token) {
            return res.status(400).json({ message: 'Email verification token is required.', field: 'email_verification_token' });
        }
        const verifiedEmail = verifyTempToken(email_verification_token, 'registration');
        if (!verifiedEmail || verifiedEmail.toLowerCase() !== cleanEmail) {
            return res.status(400).json({ message: 'Invalid or expired email verification token.', field: 'email_verification_token' });
        }

        if (password !== password_confirm) {
            return res.status(400).json({ message: 'Passwords do not match.', field: 'password_confirm' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError, field: 'password' });
        }

        const rank = Number(kcet_rank);
        if (!rank || rank <= 0) {
            return res.status(400).json({ message: 'Valid KCET rank is required.', field: 'kcet_rank' });
        }

        if (!category) {
            return res.status(400).json({ message: 'Category is required.', field: 'category' });
        }

        const existingStudent = await Student.findOne({ email_id: cleanEmail });
        if (existingStudent) {
            return res.status(409).json({
                error: 'Email already registered',
                message: 'An account with this email already exists. Please use a different email or try logging in.',
                field: 'email_id'
            });
        }

        const hashed_password = hashPassword(password);
        const student = new Student({
            email_id: cleanEmail,
            phone_number: String(phone_number).trim(),
            hashed_password,
            type_of_student: 'counselling',
            name: name.trim(),
            category,
            kcet_rank: rank,
        });

        await student.save();
        const tokens = generateTokens(student._id);

        res.status(201).json({
            student: student,
            tokens: {
                refresh: tokens.refresh,
                access: tokens.access,
            },
            message: 'Registration successful'
        });
    } catch (error) {
        console.error("Counselling register error:", error);
        if (error.code === 11000) { // MongoDB duplicate key
            return res.status(409).json({ error: 'Registration conflict' });
        }
        res.status(500).json({ error: 'Error creating student account' });
    }
};

// POST /api/auth/register/studying/ or /api/student/register/
const registerStudying = async (req, res) => {
    try {
        const {
            email_id,
            phone_number,
            password,
            password_confirm,
            name,
            usn,
            college_code,
            id_card_url,
            category,
            year_of_starting,
            unique_key,
            kcet_rank,
            email_verification_token,
        } = req.body;
        const cleanEmail = (email_id || '').trim().toLowerCase();

        if (
            !cleanEmail ||
            !password ||
            !phone_number ||
            !name?.trim() ||
            !usn?.trim() ||
            !college_code ||
            !id_card_url ||
            !unique_key ||
            !year_of_starting ||
            !kcet_rank
        ) {
            return res.status(400).json({
                message:
                    'Name, email, phone, college, branch, year of starting, USN, ID card, KCET rank, and password are required.',
            });
        }

        if (!email_verification_token) {
            return res.status(400).json({ message: 'Email verification token is required.', field: 'email_verification_token' });
        }
        const verifiedEmail = verifyTempToken(email_verification_token, 'registration');
        if (!verifiedEmail || verifiedEmail.toLowerCase() !== cleanEmail) {
            return res.status(400).json({ message: 'Invalid or expired email verification token.', field: 'email_verification_token' });
        }

        if (password !== password_confirm) {
            return res.status(400).json({ message: 'Passwords do not match.', field: 'password_confirm' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError, field: 'password' });
        }

        if (!category) {
            return res.status(400).json({ message: 'Category is required.', field: 'category' });
        }

        const rank = Number(kcet_rank);
        if (!rank || rank <= 0) {
            return res.status(400).json({ message: 'Valid KCET rank is required.', field: 'kcet_rank' });
        }

        const college = await College.findOne({ college_code });
        if (!college) {
            return res.status(400).json({ message: 'Invalid college selected.', field: 'college_code' });
        }

        const branch = await Branch.findOne({ _id: unique_key, college: college._id });
        if (!branch) {
            return res.status(400).json({ message: 'Invalid branch for selected college.', field: 'unique_key' });
        }

        const startYear = Number(year_of_starting);
        if (!startYear || startYear < 2000) {
            return res.status(400).json({ message: 'Valid year of starting is required.', field: 'year_of_starting' });
        }

        const existingStudent = await Student.findOne({ email_id: cleanEmail });
        if (existingStudent) {
            return res.status(409).json({
                error: 'Email already registered',
                message: 'An account with this email already exists. Please use a different email or try logging in.',
                field: 'email_id'
            });
        }
        
        const existingUsn = await Student.findOne({ usn: usn.trim() });
        if (existingUsn) {
            return res.status(409).json({
                error: 'USN already registered',
                message: 'This USN/Student ID is already registered. Please use a different USN.',
                field: 'usn'
            });
        }

        const hashed_password = hashPassword(password);
        const student = new Student({
            email_id: cleanEmail,
            phone_number: String(phone_number).trim(),
            hashed_password,
            type_of_student: 'studying',
            name: name.trim(),
            usn: usn.trim(),
            college_code,
            id_card_url,
            category,
            year_of_starting: startYear,
            unique_key,
            kcet_rank: rank,
            approval_status: 'PENDING',
            is_verified_student: false,
        });

        await student.save();

        res.status(201).json({
            student: student,
            approval_status: student.approval_status,
            message: 'Registration submitted successfully.\n\nYour account is pending administrator approval.\nYou will receive an email once your application has been reviewed.'
        });

    } catch (error) {
        console.error("Studying register error:", error);
        res.status(500).json({ error: 'Error creating student account' });
    }
};

// POST /api/auth/refresh/
const refresh = async (req, res) => {
    try {
        const refreshToken = req.body.refresh;
        if (!refreshToken) {
            return res.status(400).json({ refresh: ['This field is required.'] });
        }

        const decoded = jwt.verify(refreshToken, SECRET_KEY);
        if (decoded.token_type !== 'refresh' || !decoded.user_id) {
            return res.status(401).json({ detail: 'Given token not valid for any token type' });
        }

        const student = await Student.findOne({ _id: decoded.user_id, is_active: true });
        if (!student) {
            return res.status(401).json({ detail: 'User not found or inactive' });
        }

        const tokens = generateTokens(student._id);
        res.json({
            access: tokens.access,
            refresh: tokens.refresh,
        });
    } catch (error) {
        return res.status(401).json({ detail: 'Given token not valid for any token type' });
    }
};

// POST /api/auth/send-otp/
const sendOtp = async (req, res) => {
    try {
        const { email, purpose } = req.body;
        if (!email || !purpose) {
            return res.status(400).json({ error: 'Email and purpose are required.' });
        }

        const allowedPurposes = ['registration', 'forgot_password', 'change_password'];
        if (!allowedPurposes.includes(purpose)) {
            return res.status(400).json({ error: 'Invalid purpose.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // If purpose is change_password, verify token matches logged-in user
        if (purpose === 'change_password') {
            const authHeader = req.header('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const token = authHeader.replace('Bearer ', '');
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                if (decoded.token_type !== 'access') {
                    return res.status(401).json({ error: 'Invalid token type' });
                }
                const student = await Student.findOne({ _id: decoded.user_id, is_active: true });
                if (!student) {
                    return res.status(401).json({ error: 'User not found or inactive' });
                }
                if (student.email_id.toLowerCase() !== cleanEmail) {
                    return res.status(403).json({ error: 'Email does not match authenticated user' });
                }
            } catch (err) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }

        // Verify role availability
        const existingStudent = await Student.findOne({ email_id: cleanEmail });
        if (purpose === 'registration') {
            if (existingStudent) {
                return res.status(409).json({ error: 'Email already registered', field: 'email' });
            }
        } else if (purpose === 'forgot_password' || purpose === 'change_password') {
            if (!existingStudent) {
                return res.status(404).json({ error: 'No student account found with this email.', field: 'email' });
            }
        }

        // Enforce 60-second cooldown rate limit between requests
        const lastOtp = await OTP.findOne({ email: cleanEmail, purpose }).sort({ createdAt: -1 });
        if (lastOtp && (Date.now() - lastOtp.createdAt.getTime()) < 60000) {
            const waitTime = Math.ceil((60000 - (Date.now() - lastOtp.createdAt.getTime())) / 1000);
            return res.status(429).json({ error: `Please wait ${waitTime} seconds before requesting another OTP.`, cooldown: waitTime });
        }

        // Delete existing OTPs for this email and purpose to ensure only one is active
        await OTP.deleteMany({ email: cleanEmail, purpose });

        // Generate 6-digit numeric OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = bcrypt.hashSync(otp, 10);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

        const otpDoc = new OTP({
            email: cleanEmail,
            otpHash,
            purpose,
            attempts: 0,
            expiresAt
        });
        await otpDoc.save();

        // Send email based on purpose
        if (purpose === 'registration') {
            await sendOtpRegistrationEmail(cleanEmail, otp);
        } else if (purpose === 'forgot_password') {
            await sendOtpForgotPasswordEmail(cleanEmail, otp);
        } else if (purpose === 'change_password') {
            await sendOtpChangePasswordEmail(cleanEmail, otp);
        }

        res.json({ message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({ error: 'Error sending OTP' });
    }
};

// POST /api/auth/verify-otp/
const verifyOtp = async (req, res) => {
    try {
        const { email, otp, purpose } = req.body;
        if (!email || !otp || !purpose) {
            return res.status(400).json({ error: 'Email, OTP, and purpose are required.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const otpDoc = await OTP.findOne({ email: cleanEmail, purpose });

        if (!otpDoc) {
            return res.status(400).json({ error: 'OTP has expired or is invalid.' });
        }

        if (otpDoc.attempts >= 5) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({ error: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' });
        }

        const isMatch = bcrypt.compareSync(otp, otpDoc.otpHash);
        if (!isMatch) {
            otpDoc.attempts += 1;
            if (otpDoc.attempts >= 5) {
                await OTP.deleteOne({ _id: otpDoc._id });
                return res.status(400).json({ error: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' });
            }
            await otpDoc.save();
            return res.status(400).json({ error: `Invalid OTP. ${5 - otpDoc.attempts} attempts remaining.` });
        }

        // OTP matches - invalidate (delete) OTP and issue a short-lived temp token
        await OTP.deleteOne({ _id: otpDoc._id });
        const tempToken = generateTempToken(cleanEmail, purpose);

        res.json({ message: 'OTP verified successfully.', tempToken });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Error verifying OTP' });
    }
};

// POST /api/auth/reset-password/
const resetPassword = async (req, res) => {
    try {
        const { email, password, passwordConfirm, token } = req.body;
        if (!email || !password || !passwordConfirm || !token) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Passwords do not match.', field: 'passwordConfirm' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError, field: 'password' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const verifiedEmail = verifyTempToken(token, 'forgot_password');
        if (!verifiedEmail || verifiedEmail.toLowerCase() !== cleanEmail) {
            return res.status(400).json({ error: 'Invalid or expired verification token.' });
        }

        const student = await Student.findOne({ email_id: cleanEmail });
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        student.hashed_password = hashPassword(password);
        await student.save();

        res.json({ message: 'Password reset successful.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
};

// POST /api/auth/change-password/
const changePassword = async (req, res) => {
    try {
        const { password, passwordConfirm, token } = req.body;
        if (!password || !passwordConfirm || !token) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Passwords do not match.', field: 'passwordConfirm' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError, field: 'password' });
        }

        const verifiedEmail = verifyTempToken(token, 'change_password');
        if (!verifiedEmail || verifiedEmail.toLowerCase() !== req.user.email_id.toLowerCase()) {
            return res.status(400).json({ error: 'Invalid or expired verification token.' });
        }

        const student = await Student.findById(req.user._id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        student.hashed_password = hashPassword(password);
        await student.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
};

module.exports = {
    login,
    registerCounselling,
    registerStudying,
    refresh,
    sendOtp,
    verifyOtp,
    resetPassword,
    changePassword
};
