const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const callSchema = new Schema({
    roomId: { type: String, required: true, unique: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['active', 'ended'], default: 'active' }
});

const Call = mongoose.model("Call", callSchema);
module.exports = Call;