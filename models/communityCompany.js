const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const communityCompanySchema = new Schema({
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

const communityCompany = mongoose.model("communityCompany", communityCompanySchema);
module.exports = communityCompany;