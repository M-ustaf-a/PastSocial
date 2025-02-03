const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const communityDataSchema = new Schema({
    community: {
        type: String,
        required: true,
    },
    info: {
        type: String,
        required: true,
    }
});

const CommunityData = mongoose.model("CommunityData", communityDataSchema);
module.exports = CommunityData;