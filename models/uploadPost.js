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
        name: String,
        image: {
            url: String,
            filename: String,
        }
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
