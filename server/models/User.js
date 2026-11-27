const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  leetcodeUsername: { type: String, trim: true, maxlength: 30, default: "" },
  tokenVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false, default: undefined },
  resetTokenExpiresAt: { type: Date, select: false, default: undefined }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
