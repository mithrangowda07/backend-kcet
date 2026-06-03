const mongoose = require('mongoose');

const studentCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const StudentCounter = mongoose.model('StudentCounter', studentCounterSchema);

/**
 * Gets the next sequence number for a student.
 * @returns {Promise<number>}
 */
const getNextSequence = async () => {
    const counter = await StudentCounter.findByIdAndUpdate(
        'student_id',
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return counter.seq;
};

module.exports = {
    StudentCounter,
    getNextSequence
};
