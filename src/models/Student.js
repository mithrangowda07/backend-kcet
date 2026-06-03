const mongoose = require('mongoose');
const { getNextSequence } = require('./StudentCounter');

const studentSchema = new mongoose.Schema({
    _id: { type: String }, // student_user_id
    type_of_student: { 
        type: String, 
        required: true, 
        enum: ['counselling', 'studying'] 
    },
    name: { type: String, default: null },
    category: { type: String, default: null },
    unique_key: { type: String, default: null, ref: 'Branch' },
    year_of_starting: { type: Number, default: null },
    college_code: { type: String, default: null },
    phone_number: { type: String, required: true },
    email_id: { type: String, required: true, unique: true },
    kcet_rank: { type: Number, default: null },
    hashed_password: { type: String, required: true },
    last_login: { type: Date, default: null },
    is_active: { type: Boolean, default: true },
    profile_completed: { type: Boolean, default: false },
    usn: { type: String, unique: true, sparse: true },
    is_verified_student: { type: Boolean, default: false },
    id_card_url: { type: String, default: null },
    approval_status: { 
        type: String, 
        enum: ['PENDING', 'APPROVED', 'REJECTED'], 
        default: 'PENDING' 
    },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    reviewed_at: { type: Date, default: null },
    rejection_reason: { type: String, default: '' },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.student_user_id = ret._id;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.student_user_id = ret._id;
            return ret;
        }
    },
    _id: false // We will set _id manually in pre-save hook
});

// Add _id as primary key explicitly since we disabled auto _id
studentSchema.add({ _id: String });

studentSchema.pre('save', async function () {
    if (!this.usn) {
        this.usn = undefined;
    }

    if (!this.isNew || this._id) {
        return;
    }

    try {
        const nextId = await getNextSequence();
        const nextIdStr = nextId.toString().padStart(6, '0');
        
        if (this.type_of_student === 'counselling') {
            const currentYear = new Date().getFullYear().toString();
            this._id = `${currentYear}${nextIdStr}`;
        } else if (this.type_of_student === 'studying') {
            if (!this.college_code) {
                throw new Error("college_code is required for studying students");
            }
            this._id = `${this.college_code}${nextIdStr}`;
        }
    } catch (error) {
        throw error;
    }
});

module.exports = mongoose.model('Student', studentSchema);
