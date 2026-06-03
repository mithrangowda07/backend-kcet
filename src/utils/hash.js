const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Validates a Django pbkdf2_sha256 hash or standard bcrypt hash.
 * @param {string} password - The plain text password.
 * @param {string} encoded - The hash stored in the database.
 * @returns {boolean} True if password is valid, false otherwise.
 */
const verifyPassword = (password, encoded) => {
    if (!encoded) return false;

    // Check if it's a Django pbkdf2_sha256 hash
    if (encoded.startsWith('pbkdf2_sha256$')) {
        const parts = encoded.split('$');
        if (parts.length !== 4) return false;

        const iterations = parseInt(parts[1], 10);
        const salt = parts[2];
        const hash = parts[3];

        const key = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
        const calculatedHash = key.toString('base64');
        return calculatedHash === hash;
    }

    // Otherwise, assume it might be a bcrypt hash (for newly created users in Node)
    return bcrypt.compareSync(password, encoded);
};

/**
 * Hashes a password using bcrypt (used for new users or password resets).
 * @param {string} password 
 * @returns {string} The hashed password.
 */
const hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

module.exports = {
    verifyPassword,
    hashPassword
};
