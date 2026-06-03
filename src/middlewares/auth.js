const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../utils/jwt');
const Student = require('../models/Student'); // Will be created later

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, SECRET_KEY);

        if (decoded.token_type !== 'access') {
            return res.status(401).json({ detail: 'Given token not valid for any token type', code: 'token_not_valid' });
        }

        const student = await Student.findOne({ _id: decoded.user_id, is_active: true })
            .populate({ path: 'unique_key', populate: { path: 'college' } });
        if (!student) {
            return res.status(401).json({ detail: 'User not found or inactive', code: 'user_not_found' });
        }

        const populatedBranch = student.unique_key;
        const uniqueKeyString = populatedBranch && typeof populatedBranch === 'object'
            ? populatedBranch._id || populatedBranch.unique_key || populatedBranch
            : populatedBranch;

        student.unique_key_data = populatedBranch;
        student.unique_key = uniqueKeyString;
        req.user = student;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ detail: 'Given token not valid for any token type', code: 'token_not_valid', messages: [{ token_class: 'AccessToken', token_type: 'access', message: 'Token is invalid or expired' }] });
        }
        return res.status(401).json({ detail: 'Given token not valid for any token type', code: 'token_not_valid' });
    }
};

module.exports = authMiddleware;
