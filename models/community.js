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
    useradmin: {
       type: Object,
       default: {},
    },
    admin: {
        type: String,
        required: true
    },
    userid: {
        type: String,
        required: true,
    }
});

const Community = mongoose.model("Community", userSchema);
module.exports = Community;