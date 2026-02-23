const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String, // '3d-character', '4k-upscale', 'beauty-filter', 'video-filter'
        required: true
    },
    prompt: {
        type: String
    },
    resultUrl: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('History', HistorySchema);
