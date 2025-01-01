const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    username: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
        required: true
    }
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;