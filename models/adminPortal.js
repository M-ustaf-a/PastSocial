const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminPortalSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    communityId: {
        type: Schema.Types.ObjectId,
        ref: 'Community',
        required: true,
    },
    password: {
        type: String,
        required: true,
    }
});

const AdminPortal = mongoose.model("AdminPortal", adminPortalSchema);
module.exports = AdminPortal;