const mongoose = require("mongoose");
const { Schema } = mongoose;

const uploadPostSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true
    },

    user:{
        type: Object,
        default: {},
    },
    community: {
        type: Schema.Types.ObjectId,
        ref: "Community",
        required: true,
    },
    image: {
        url: String,
        filename: String,
    },
});
const uploadPost = mongoose.model("uploadPost", uploadPostSchema);
module.exports = uploadPost;
