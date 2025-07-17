// email-backend/server.cjs (Resend version)
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigins = ['http://localhost:5173', 'https://quote-management-system-57438.web.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy does not allow access from origin ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

const upload = multer({ dest: "uploads/" });

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/send", upload.fields([
  { name: "quoteFile" },
  { name: "conversation" }
]), async (req, res) => {
  console.log("📥 Received POST /send");

  const { message, subject, to, conversationLink } = req.body;
  console.log("➡️ Sending email to:", to);

  const quoteFile = req.files["quoteFile"]?.[0];
  const convFile = req.files["conversation"]?.[0];

  try {
    const attachments = [];

    if (quoteFile) {
      const content = fs.readFileSync(quoteFile.path).toString("base64");
      attachments.push({
        filename: quoteFile.originalname,
        content,
        type: quoteFile.mimetype,
      });
    }

    if (convFile) {
      const content = fs.readFileSync(convFile.path).toString("base64");
      attachments.push({
        filename: convFile.originalname,
        content,
        type: convFile.mimetype,
      });
    }

    const fullBody = message + (conversationLink ? `\n\nConversation Link: ${conversationLink}` : '');
    const sender = req.body.sender || process.env.RESEND_SENDER;

    await resend.emails.send({
      from: sender,
      to,
      subject,
      text: fullBody,
      attachments,
    });

    if (quoteFile) fs.unlinkSync(quoteFile.path);
    if (convFile) fs.unlinkSync(convFile.path);

    console.log("✅ Email sent via Resend");
    res.status(200).json({ message: "Email sent via Resend" });
  } catch (error) {
    console.error("❌ Resend error:", error);
    res.status(500).send("Failed to send email.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Resend email server running on port ${PORT}`);
});
