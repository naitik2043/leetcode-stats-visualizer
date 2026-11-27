const mongoose = require("mongoose");
const { Schema } = mongoose;

const integrationTicketSchema = new Schema({
  ticketId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { collection: "integration_tickets", timestamps: true, versionKey: false });

module.exports = mongoose.models.IntegrationTicket || mongoose.model("IntegrationTicket", integrationTicketSchema);
