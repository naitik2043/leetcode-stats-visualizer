const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  usernameKey: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  metric: { type: String, required: true, enum: ["totalSolved", "easy", "medium", "hard"] },
  target: { type: Number, required: true, min: 1, max: 10000 },
  baselineValue: { type: Number, required: true, min: 0 },
  baselineSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSnapshot", required: true },
  period: { type: String, required: true, enum: ["7d", "30d"] },
  startsAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  status: { type: String, enum: ["active", "completed", "archived"], default: "active" }
}, { timestamps: true, versionKey: false });

goalSchema.index({ userId: 1, status: 1, dueAt: 1 });

module.exports = mongoose.models.Goal || mongoose.model("Goal", goalSchema);
