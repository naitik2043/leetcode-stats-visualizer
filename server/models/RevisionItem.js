const mongoose = require("mongoose");

const revisionItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  usernameKey: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  problemUrl: { type: String, trim: true, maxlength: 250, default: "" },
  difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
  topic: { type: String, trim: true, maxlength: 60, default: "" },
  attemptsBeforeAccepted: { type: Number, min: 1, max: 100, default: null },
  timeSpentMinutes: { type: Number, min: 1, max: 600, default: null },
  mistakeType: {
    type: String,
    enum: ["pattern-recognition", "edge-cases", "complexity", "implementation", "recall", "other"],
    default: "other"
  },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["queued", "reviewing", "mastered"], default: "queued" },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

revisionItemSchema.index({ userId: 1, usernameKey: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.models.RevisionItem ||
  mongoose.model("RevisionItem", revisionItemSchema);
