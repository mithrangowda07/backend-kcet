const jwt = require('jsonwebtoken');
const AdminAccount = require('../models/AdminAccount');
require('dotenv').config();

const adminAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization header missing or invalid' });
        }

        const token = authHeader.split(' ')[1];
        
        try {
            // Using same secret as Django to verify tokens if they exist, or Node's own
            const decoded = jwt.verify(token, process.env.SECRET_KEY || 'django-insecure-change-this-in-production');
            
            const admin = await AdminAccount.findById(decoded.admin_id || decoded.id);
            if (!admin || !admin.is_active) {
                return res.status(401).json({ error: 'Invalid or inactive admin account' });
            }
            
            req.admin = admin;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error in admin authentication' });
    }
};

module.exports = adminAuthMiddleware;
