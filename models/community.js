const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    thumbnail: {
        url: String,
        filename: String,
    },
    user:{
        type: Object,
        default: {},
    },
    admin: {
        type: String,
        required: true
    }
});

const Community = mongoose.model("Community", userSchema);
module.exports = Community;