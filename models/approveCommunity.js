const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    company: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
    },
    image: {
        url: String,
        filename: String,
    },
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
    },
    reason: {
        type: String,
        required: true,
    },
    status: {
        type: Boolean,
        default: false,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    createAt: {
        type: Date,
        default: Date.now,
    },
});

const ApprovalCommunity = mongoose.model("ApprovalCommunity", userSchema);
module.exports = ApprovalCommunity;