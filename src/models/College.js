const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const collegeSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // college_id
    public_id: { type: String, default: uuidv4, unique: true },
    college_code: { type: String, required: true, unique: true },
    college_name: { type: String, required: true },
    location: { type: String, required: true },
    college_link: { type: String, default: null },
}, {
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.college_id = ret._id;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.college_id = ret._id;
            return ret;
        }
    }
});

module.exports = mongoose.model('College', collegeSchema);
