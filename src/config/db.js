const mongoose = require('mongoose');

// Prevent buffering commands when connection is not ready
mongoose.set('bufferCommands', false);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = {
        conn: null,
        promise: null,
    };
}

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('MONGODB_URI not found in environment variables');
    }

    // Return existing connection if already established
    if (cached.conn) {
        return cached.conn;
    }

    // Create the connection promise if it doesn't exist
    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000, // Fail fast on connection errors to avoid serverless function timeouts
            socketTimeoutMS: 45000,
            family: 4, // IPv4 preference
        };

        cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
            return mongooseInstance;
        });
    }

    try {
        cached.conn = await cached.promise;
        console.log('MongoDB connected successfully (reused or newly connected)');
        return cached.conn;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        cached.promise = null; // Clear failed promise so retry is possible
        throw error;
    }
};

module.exports = connectDB;