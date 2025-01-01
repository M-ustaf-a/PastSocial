const mongoose = require("mongoose");
const suggestionSchema = require("./suggestion"); 
const Schema = mongoose.Schema;

const postSchema = new Schema({
    username: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    content: String,
    image: {
        url: [String], 
        filename: [String],
    },
    video: {
        url: String,
        filename: String,
    },
    suggestions: [suggestionSchema], 
    community: {
        type: Schema.Types.ObjectId,
        ref: 'community',
        required: true
    }
});


const Post = mongoose.model("Post", postSchema); 
module.exports = Post;