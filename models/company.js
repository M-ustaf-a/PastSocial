const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const companySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    image: {
        url: String,
        filename: String,
    },
});

const Company = mongoose.model("Company", companySchema);
module.exports = Company;