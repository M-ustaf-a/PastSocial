const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    age: {
        type: Number,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String, // Changed from Number to String
    },
    profilePhoto: {
        url: String,
        filename: String,
    },
    bio: {
        type: String,
        // Remove required: true if it's optional
    },
    occupation: {
        type: String,
        required: true,
    },
    company: {
        type: String,
        // Remove required: true if it's optional
    },
    desiredRole: {
       type: String,
       required: true,
       enum: [
        "member",
        "contributor", 
        "mentor",
        "organizer",
        "moderator",
        "other"
       ],
    },
    skills: {
       type: String,
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
    createdAt: { // Fixed typo from createAt
        type: Date,
        default: Date.now,
    },
    references:{
        type: String,
    }
});

const ApprovalCommunity = mongoose.model("ApprovalCommunity", userSchema);
module.exports = ApprovalCommunity;