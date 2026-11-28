const mongoose = require("mongoose");

const roadmapSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  usernameKey: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  horizonDays: { type: Number, required: true, enum: [7, 30, 90] },
  plan: { type: mongoose.Schema.Types.Mixed, required: true },
  progress: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, default: 1, min: 1 }
}, { timestamps: true, versionKey: false });

roadmapSchema.index({ userId: 1, usernameKey: 1, updatedAt: -1 });

module.exports = mongoose.models.Roadmap || mongoose.model("Roadmap", roadmapSchema);
