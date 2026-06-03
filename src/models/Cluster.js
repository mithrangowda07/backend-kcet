const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // cluster_code
    cluster_name: { type: String, required: true },
}, {
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.cluster_code = ret._id;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.cluster_code = ret._id;
            return ret;
        }
    }
});

module.exports = mongoose.model('Cluster', clusterSchema);
