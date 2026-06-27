const Student = require('../models/Student');
const { uploadToS3Url } = require('../utils/s3Upload');
const { validateKcetRank } = require('../utils/validation');

// GET /api/auth/me/
const me = async (req, res) => {
    const user = req.user;
    if (user && user.toObject) {
        const userObj = user.toObject();
        // Preserve the populated branch object if available; fall back to the stored unique_key
        userObj.unique_key_data = user.unique_key_data || userObj.unique_key;
        return res.json(userObj);
    }
    res.json(req.user);
};

// PATCH /api/auth/profile/
const updateProfile = async (req, res) => {
    try {
        const allowedUpdates = req.user.type_of_student === 'studying'
            ? ['name', 'phone_number', 'category', 'year_of_starting']
            : ['name', 'phone_number', 'category', 'year_of_starting', 'kcet_rank'];
        const updates = Object.keys(req.body);
        
        if (req.user.type_of_student === 'counselling' && req.body.kcet_rank !== undefined) {
            const rankError = validateKcetRank(req.body.kcet_rank);
            if (rankError) {
                return res.status(400).json({ error: rankError, field: 'kcet_rank' });
            }
        }

        updates.forEach(update => {
            if (allowedUpdates.includes(update)) {
                req.user[update] = req.body[update];
            }
        });

        await req.user.save();
        res.json(req.user);
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(400).json({ error: "Bad request" });
    }
};

// POST /api/student/upload-id-card/
const uploadIdCard = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileBuffer = req.file.buffer;
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        
        // Ensure size limit (multer does this but just to be safe)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'File size exceeds 10MB limit' });
        }

        const idImageUrl = await uploadToS3Url(fileBuffer, originalName, mimeType, 'student_id_cards');
        
        res.json({ id_card_url: idImageUrl });
    } catch (error) {
        console.error("Upload ID card error:", error);
        res.status(500).json({ error: 'Error uploading file' });
    }
};

module.exports = {
    me,
    updateProfile,
    uploadIdCard
};
