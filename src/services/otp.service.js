const redisClient = require('../config/redisClient');
const bcrypt = require('bcryptjs');

/**
 * Generate a secure 6-digit numeric OTP
 * @returns {string}
 */
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash and store the OTP in Redis with a 180-second expiry (TTL)
 * @param {string} phone - User's phone number or unique identifier (e.g. email)
 * @param {string} otp - Plaintext OTP
 */
const storeOtp = async (phone, otp) => {
    if (!redisClient.isOpen) {
        throw new Error('Redis service is currently unavailable. Connection is closed.');
    }

    try {
        // Hash the OTP using bcrypt with 10 salt rounds
        const salt = await bcrypt.genSalt(10);
        const hashedOtp = await bcrypt.hash(otp, salt);

        const key = `otp:${phone}`;
        
        // Save the hashed OTP with an expiration of 180 seconds (3 minutes)
        await redisClient.set(key, hashedOtp, {
            EX: 180
        });
    } catch (err) {
        console.error('Error storing OTP in Redis:', err);
        throw new Error('Failed to store OTP in the cache service.');
    }
};

/**
 * Fetch and verify the entered OTP against the hashed OTP stored in Redis
 * If valid, immediately deletes the OTP from Redis.
 * @param {string} phone - User's phone number or unique identifier
 * @param {string} otp - The plain text OTP entered by the user
 * @returns {Promise<boolean>} - True if verification succeeds, false otherwise
 */
const verifyOtp = async (phone, otp) => {
    if (!redisClient.isOpen) {
        throw new Error('Redis service is currently unavailable. Connection is closed.');
    }

    try {
        const key = `otp:${phone}`;
        const hashedOtp = await redisClient.get(key);

        if (!hashedOtp) {
            // OTP has expired or does not exist
            return false;
        }

        // Compare entered OTP with hashed OTP
        const isMatch = await bcrypt.compare(otp, hashedOtp);
        
        if (isMatch) {
            // Delete OTP immediately to prevent reuse
            await deleteOtp(phone);
            return true;
        }

        return false;
    } catch (err) {
        console.error('Error verifying OTP in Redis:', err);
        throw new Error('Failed to verify OTP with the cache service.');
    }
};

/**
 * Remove OTP from Redis
 * @param {string} phone - User's phone number or unique identifier
 */
const deleteOtp = async (phone) => {
    if (!redisClient.isOpen) {
        throw new Error('Redis service is currently unavailable. Connection is closed.');
    }

    try {
        const key = `otp:${phone}`;
        await redisClient.del(key);
    } catch (err) {
        console.error('Error deleting OTP from Redis:', err);
        throw new Error('Failed to delete OTP from the cache service.');
    }
};

module.exports = {
    generateOtp,
    storeOtp,
    verifyOtp,
    deleteOtp
};
