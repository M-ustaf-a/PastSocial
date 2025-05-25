const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CompanyListingSchema = new Schema({
  // Reference to the associated community
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    required: true,
  },

  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  foundedYear: {
    type: Number,
    required: true,
    min: 1800,
    max: new Date().getFullYear(), // current year as max
  },
  industry: {
    type: String,
    required: true,
    enum: [
      "technology",
      "healthcare",
      "finance",
      "education",
      "retail",
      "manufacturing",
      "energy",
      "agriculture",
      "entertainment",
      "other"
    ],
  },
  size: {
    type: String,
    required: true,
    enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001+"],
  },
  website: {
    type: String,
    required: true,
  },

  // Contact Information
  contactName: {
    type: String,
    required: true,
  },
  contactPosition: {
    type: String,
  },
  contactEmail: {
    type: String,
    required: true,
  },
  contactPhone: {
    type: String,
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },

  // Company Verification Documents
  registrationNumber: {
    type: String,
    required: true,
  },
  logo: {
    url: String,      // URL/path to the uploaded company logo
    filename: String, // Filename if stored locally or in cloud storage
  },
  verification: {
    url: String,      // URL/path to the uploaded verification document(s)
    filename: String,
  },

  // Terms and Conditions / Consent
  termsAgreed: {
    type: Boolean,
    required: true,
  },
  dataConsent: {
    type: Boolean,
    required: true,
  },
  marketingConsent: {
    type: Boolean,
    default: false,
  },
  time: {
    type: String,
  }
}, {
  timestamps: true, // automatically adds createdAt & updatedAt
});

const CompanyListing = mongoose.model("CompanyListing", CompanyListingSchema);
module.exports = CompanyListing;