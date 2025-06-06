const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userApprovalSchema = new Schema({
    name: {
       type: String,
       required: true,
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
        unique: true,
    },
    bio: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    image: {
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        }
    },
    company: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    status: {
        type: Boolean,
        default: false
    },
    createAt: {
        type: Date,
        default: Date.now,
    }
});

const UserApproval = mongoose.model("UserApproval", userApprovalSchema);
module.exports = UserApproval; 