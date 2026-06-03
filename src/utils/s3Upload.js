const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, bucketName } = require('../config/s3');
const crypto = require('crypto');
const path = require('path');

/**
 * Uploads a file buffer to S3 and returns the URL.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} originalName - The original file name.
 * @param {string} mimeType - The mime type of the file.
 * @param {string} folder - The S3 folder (e.g., 'student_id_cards').
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
const uploadToS3 = async (fileBuffer, originalName, mimeType, folder = 'uploads', customKey = null) => {
    if (!s3Client || !bucketName) {
        console.warn("AWS S3 not configured properly. Skipping upload and returning dummy URL.");
        const key = customKey || `${folder}/${originalName}`;
        return `https://dummy-s3-url.com/${key}`;
    }

    const extension = path.extname(originalName) || '';
    const uniqueFilename =
        customKey || `${folder}/${crypto.randomBytes(16).toString('hex')}${extension}`;

    const putParams = {
        Bucket: bucketName,
        Key: uniqueFilename,
        Body: fileBuffer,
        ContentType: mimeType,
    };

    // Many modern S3 buckets disable ACLs (Object Ownership = Bucket owner enforced).
    const acl = process.env.AWS_S3_DEFAULT_ACL;
    if (acl && acl !== 'none' && acl !== 'disabled') {
        putParams.ACL = acl;
    }

    const command = new PutObjectCommand(putParams);

    try {
        await s3Client.send(command);
        const region = process.env.AWS_S3_REGION_NAME || 'ap-south-1';
        const url = `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueFilename}`;
        return { url, key: uniqueFilename };
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload file to S3");
    }
};

/**
 * Backward-compatible helper: returns public URL string.
 */
const uploadToS3Url = async (fileBuffer, originalName, mimeType, folder = 'uploads', customKey = null) => {
    const result = await uploadToS3(fileBuffer, originalName, mimeType, folder, customKey);
    return typeof result === 'string' ? result : result.url;
};

/**
 * Parses an S3 object URL to extract the object key.
 * @param {string} url - The full S3 URL.
 * @returns {string|null} The object key.
 */
const getKeyFromUrl = (url) => {
    if (!url) return null;
    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const parsedUrl = new URL(url);
            let pathname = parsedUrl.pathname;
            if (pathname.startsWith('/')) {
                pathname = pathname.substring(1);
            }
            if (bucketName && parsedUrl.hostname.includes('amazonaws.com') && !parsedUrl.hostname.startsWith(bucketName + '.')) {
                if (pathname.startsWith(bucketName + '/')) {
                    return pathname.substring(bucketName.length + 1);
                }
            }
            return pathname;
        }
        return url;
    } catch (err) {
        console.error("Error parsing URL to get S3 key:", err);
        return url;
    }
};

/**
 * Generates a pre-signed URL for an S3 object URL.
 * @param {string} url - The full S3 URL or S3 key.
 * @param {number} expiresIn - Expiration time in seconds (default 3600).
 * @returns {Promise<string|null>} The pre-signed URL.
 */
const getPresignedUrlFromObjectUrl = async (url, expiresIn = 3600) => {
    if (!url) return null;
    if (!s3Client || !bucketName) {
        console.warn("AWS S3 not configured. Returning dummy pre-signed URL.");
        return `https://dummy-presigned-url.com/${url}?token=dummy`;
    }

    const key = getKeyFromUrl(url);
    if (!key) return null;

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error("Error generating pre-signed URL:", error);
        return null;
    }
};

module.exports = {
    uploadToS3,
    uploadToS3Url,
    getKeyFromUrl,
    getPresignedUrlFromObjectUrl,
};
