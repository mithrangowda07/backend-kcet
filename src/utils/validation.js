const MAX_KCET_RANK = 400000;
const validateKcetRank = (kcet_rank) => {
    const rank = Number(kcet_rank);
    if (!Number.isInteger(rank) || rank < 1 || rank > MAX_KCET_RANK) {
        return 'KCET rank must be between 1 and 400,000.';
    }
    return null;
};

const validatePassword = (password) => {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter.';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter.';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'Password must contain at least one special character.';
    }
    return null;
};

module.exports = { validatePassword, validateKcetRank, MAX_KCET_RANK };
