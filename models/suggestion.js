const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const suggestionSchema = new Schema({
  username1: String,
  suggestion: String,
});

module.exports = suggestionSchema;
