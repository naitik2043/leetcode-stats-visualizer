const mongoose = require("mongoose");

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ["new", "reviewed", "closed"], default: "new" }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.ContactMessage || mongoose.model("ContactMessage", contactMessageSchema);
