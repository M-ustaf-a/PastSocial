const mongoose = require("mongoose");
const Schema = mongoose.model;

const messageSchema = new Schema({
    content: { type: String, required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    room: { type: String, required: true }, // project-id or direct-message-id
    type: { type: String, enum: ['text', 'file', 'image'], default: 'text' },
    fileName: { type: String },
    fileUrl: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;