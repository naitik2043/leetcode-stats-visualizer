const mongoose = require("mongoose");

const profileSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  usernameKey: { type: String, required: true, lowercase: true, trim: true },
  dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  totalSolved: { type: Number, required: true, min: 0 },
  solved: {
    easy: { type: Number, default: 0, min: 0 },
    medium: { type: Number, default: 0, min: 0 },
    hard: { type: Number, default: 0, min: 0 }
  },
  totalQuestions: {
    easy: { type: Number, default: 0, min: 0 },
    medium: { type: Number, default: 0, min: 0 },
    hard: { type: Number, default: 0, min: 0 }
  },
  acceptedTotal: { type: Number, required: true, min: 0 },
  submissionTotal: { type: Number, required: true, min: 0 },
  acceptanceRate: { type: Number, required: true, min: 0, max: 100 },
  source: { type: String, default: "leetcode-public-profile", immutable: true }
}, { timestamps: true, versionKey: false });

profileSnapshotSchema.index(
  { userId: 1, usernameKey: 1, dateKey: 1 },
  { unique: true, name: "one_snapshot_per_user_profile_day" }
);
profileSnapshotSchema.index({ userId: 1, usernameKey: 1, dateKey: -1 });
profileSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.models.ProfileSnapshot ||
  mongoose.model("ProfileSnapshot", profileSnapshotSchema);
