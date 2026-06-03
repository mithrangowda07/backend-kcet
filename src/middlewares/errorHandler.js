/**
 * errorHandler
 * Global error handling middleware.
 * Formats database validation, casting errors, and unexpected server issues as JSON responses.
 */
const errorHandler = (err, req, res, next) => {
    // Log the error systematically
    console.error(`[Global Error Handler] Error: ${err.message}`, {
        method: req.method,
        url: req.url,
        stack: err.stack,
    });

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            error: 'ValidationError',
            message: 'Validation failed for one or more fields.',
            details
        });
    }

    // Mongoose Cast Error (e.g., malformed ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'CastError',
            message: `Invalid identifier format: Cast failed for value "${err.value}" at path "${err.path}"`
        });
    }

    // Default Error Status Code
    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'An unexpected internal server error occurred.',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

module.exports = errorHandler;
