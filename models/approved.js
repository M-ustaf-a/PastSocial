const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const approvedSchema = new Schema({
    name: {
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
    image:{
        url: String,
        filename: String,
    },

    email: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    status: {
        type: Boolean,
        default: false,
    },
});

const Approval = mongoose.model("Approval", approvedSchema);
module.exports = Approval;