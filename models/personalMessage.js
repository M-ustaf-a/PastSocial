const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    name: String,
    image: {
        url: String,
        filename: String,
    },
    
})
