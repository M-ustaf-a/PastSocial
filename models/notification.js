const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    type: {
        type: String,
        enum: ['membership_request', 'system_alert'],
        required: true
    },
    content: {
        type: Object,
        required: true,
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createAt: {
        type: Date,
        default: Date.now(),
    },
    requestId: {
        type: mongoose.Types.ObjectId,
        ref: 'Approval',
    },
   
});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;