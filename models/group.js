const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const groupSchema = new Schema({
    projectName: {
        type: String,
        required: true
    },
    projectDescription: {
        type: String,
        required: true
    },
    image: {
        url: String,
        filename: String
    },
    creator: {
        type: String
    }
});

const Group = mongoose.model('Group', groupSchema);
module.exports = Group;