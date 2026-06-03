const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = {
        conn: null,
        promise: null,
    };
}

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error(
                'MONGODB_URI not found in environment variables'
            );
        }

        // Return existing connection if already connected
        if (cached.conn) {
            return cached.conn;
        }

        // Create connection promise only once
        if (!cached.promise) {
            cached.promise = mongoose.connect(uri, {
                family: 4,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
            });
        }

        cached.conn = await cached.promise;

        console.log('MongoDB connected successfully');

        return cached.conn;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        cached.promise = null;
        throw error;
    }
};

module.exports = connectDB;