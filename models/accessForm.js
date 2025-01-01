const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const accessFormSchema = new Schema({
    name: String,
    role: String,
    email: String,
    image: {
        url: String,
        filename: String,
    },
    company: String,
    reason: String,
});

const accessForm = mongoose.model("accessForm", accessFormSchema);
module.exports = accessForm;