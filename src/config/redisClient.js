const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisClient = createClient({
    url: redisUrl
});

redisClient.on('error', (err) => {
    console.error('Redis Client Connection Error:', err.message);
});

redisClient.on('connect', () => {
    console.log('Redis client successfully initiated connection');
});

redisClient.on('ready', () => {
    console.log('Redis client is connected and ready to use');
});

// Auto-connect to Redis and handle any failures gracefully on startup
redisClient.connect().catch((err) => {
    console.error('Failed to establish initial Redis connection:', err.message);
});

module.exports = redisClient;
