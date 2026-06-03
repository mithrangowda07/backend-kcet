const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

let s3Client;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: process.env.AWS_S3_REGION_NAME || 'ap-south-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
} else {
    console.warn('AWS credentials not found. S3 uploads will fail if attempted.');
}

module.exports = {
    s3Client,
    bucketName: process.env.AWS_STORAGE_BUCKET_NAME
};
