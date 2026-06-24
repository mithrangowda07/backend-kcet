const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'django-insecure-change-this-in-production';

if (SECRET_KEY === 'django-insecure-change-this-in-production') {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET or SECRET_KEY environment variable is not defined in production.');
    }
    console.warn('WARNING: JWT_SECRET or SECRET_KEY is not defined. Using insecure default fallback for development.');
}

/**
 * Generates an access token and refresh token compatible with Django's SimpleJWT.
 * @param {string} userId - The user's student_user_id.
 * @returns {Object} { access, refresh }
 */
const generateTokens = (userId) => {
    const accessPayload = {
        token_type: 'access',
        user_id: userId,
    };

    const refreshPayload = {
        token_type: 'refresh',
        user_id: userId,
    };

    const access = jwt.sign(accessPayload, SECRET_KEY, { expiresIn: '1h' });
    const refresh = jwt.sign(refreshPayload, SECRET_KEY, { expiresIn: '7d' });

    return { access, refresh };
};

const generateAdminTokens = (adminId, email) => {
    const accessPayload = {
        token_type: 'access',
        is_admin: true,
        admin_id: adminId,
        email: email
    };
    const access = jwt.sign(accessPayload, SECRET_KEY, { expiresIn: '12h' });
    return { access };
};

const generateTempToken = (email, purpose) => {
    return jwt.sign({ email, purpose, token_type: 'temp' }, SECRET_KEY, { expiresIn: '15m' });
};

const verifyTempToken = (token, purpose) => {
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.token_type !== 'temp' || decoded.purpose !== purpose) return null;
        return decoded.email;
    } catch {
        return null;
    }
};

module.exports = {
    generateTokens,
    generateAdminTokens,
    generateTempToken,
    verifyTempToken,
    SECRET_KEY
};
