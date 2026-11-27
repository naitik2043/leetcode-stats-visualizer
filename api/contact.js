const connectToDatabase = require("../server/db");
const ContactMessage = require("../server/models/ContactMessage");
const { json, enforceSameOrigin, rateLimit, methodNotAllowed, isValidEmail } = require("../server/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res, "POST");
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, "contact", 5, 60 * 60 * 1000)) return;

  const { name, email, subject, message } = req.body || {};
  const fields = {
    name: typeof name === "string" ? name.trim() : "",
    email: typeof email === "string" ? email.trim().toLowerCase() : "",
    subject: typeof subject === "string" ? subject.trim() : "",
    message: typeof message === "string" ? message.trim() : ""
  };
  if (fields.name.length < 2 || fields.name.length > 80) return json(res, 400, { error: "Enter a name between 2 and 80 characters." });
  if (!isValidEmail(fields.email)) return json(res, 400, { error: "Enter a valid email address." });
  if (fields.subject.length < 3 || fields.subject.length > 120) return json(res, 400, { error: "Subject must be between 3 and 120 characters." });
  if (fields.message.length < 10 || fields.message.length > 3000) return json(res, 400, { error: "Message must be between 10 and 3,000 characters." });

  try {
    await connectToDatabase();
    await ContactMessage.create(fields);
    return json(res, 201, { ok: true });
  } catch (error) {
    if (error.code === "DATABASE_NOT_CONFIGURED") return json(res, 503, { error: "The contact form is not available until the project database is configured. Please open a GitHub issue instead." });
    console.error("contact_request_failed", error.message);
    return json(res, 500, { error: "We could not save your message. Please try again later." });
  }
};
