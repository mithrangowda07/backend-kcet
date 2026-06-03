const connectDB = require('../config/db');

/**
 * dbMiddleware
 * Ensuring database connectivity before any route handlers execute.
 * Prevents Mongoose operations from executing when readyState is not 1 (connected),
 * throwing clean JSON errors instead of letting requests hang or crash.
 */
const dbMiddleware = async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('[dbMiddleware] Connection check failed:', error);
        res.status(500).json({
            error: 'DatabaseConnectionError',
            message: 'Failed to establish connection to the database. Please try again later.'
        });
    }
};

module.exports = dbMiddleware;
