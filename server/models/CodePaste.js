const mongoose = require("mongoose");
const { Schema } = mongoose;

const codePasteSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  content: { type: String, required: true, maxlength: 1048576 },
  language: { type: String, default: "text", maxlength: 30 },
  category: { type: String, enum: ["snippet", "solution", "template", "notes"], default: "snippet" },
  problemTitle: { type: String, default: "", maxlength: 120 },
  problemUrl: { type: String, default: "", maxlength: 250 },
  difficulty: { type: String, enum: ["", "Easy", "Medium", "Hard"], default: "" },
  topic: { type: String, default: "", maxlength: 60 },
  tags: { type: [String], default: [] },
  visibility: { type: String, enum: ["private", "unlisted"], default: "private" },
  shareId: { type: String, sparse: true, unique: true },
  isPinned: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  history: { type: [Schema.Types.Mixed], default: [] }
}, { collection: "code_pastes", timestamps: true, versionKey: false });

codePasteSchema.index({ userId: 1, updatedAt: -1 });
codePasteSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });

module.exports = mongoose.models.CodePaste || mongoose.model("CodePaste", codePasteSchema);
