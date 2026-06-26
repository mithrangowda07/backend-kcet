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

clusterSchema.post('save', async function (doc) {
    try {
        const Branch = mongoose.model('Branch');
        await Branch.updateMany(
            { cluster: doc._id },
            {
                cluster_name: doc.cluster_name,
            }
        );
    } catch (err) {
        console.error('Error updating branches after cluster save:', err);
    }
});

module.exports = mongoose.model('Cluster', clusterSchema);
