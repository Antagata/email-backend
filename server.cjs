// email-backend/server.cjs (SendGrid version with attachments and CC)
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY); // Must be set in .env

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigins = ['http://localhost:5173', 'https://quote-management-system-57438.web.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      const msg = `CORS policy does not allow access from origin ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

const upload = multer({ dest: "uploads/" });

app.post("/send", upload.fields([
  { name: "quoteFile" },
  { name: "conversation" }
]), async (req, res) => {
  console.log("📥 Received POST /send");

  const { message, subject, to, conversationLink, sender } = req.body;
  const quoteFile = req.files["quoteFile"]?.[0];
  const convFile = req.files["conversation"]?.[0];

  const finalTo = "export@avu.wine";
  const finalCc = sender && sender.endsWith("@avu.wine") ? sender : undefined;

  try {
    const attachments = [];

    if (quoteFile) {
      const content = fs.readFileSync(quoteFile.path).toString("base64");
      attachments.push({
        content,
        filename: quoteFile.originalname,
        type: quoteFile.mimetype,
        disposition: "attachment"
      });
    }

    if (convFile) {
      const content = fs.readFileSync(convFile.path).toString("base64");
      attachments.push({
        content,
        filename: convFile.originalname,
        type: convFile.mimetype,
        disposition: "attachment"
      });
    }

    const fullBody = message + (conversationLink ? `\n\nConversation Link: ${conversationLink}` : '');

    const emailPayload = {
      to: finalTo,
      from: finalCc || 'logistics@avu.wine', // fallback if no sender
      subject,
      text: fullBody,
      cc: finalCc,
      attachments,
    };

    console.log("📤 Sending email payload via SendGrid:", {
      to: finalTo,
      cc: finalCc,
      from: emailPayload.from,
      subject,
      attachments: attachments.map(a => a.filename),
    });

    await sgMail.send(emailPayload);

    if (quoteFile) fs.unlinkSync(quoteFile.path);
    if (convFile) fs.unlinkSync(convFile.path);

    console.log("✅ Email sent via SendGrid");
    res.status(200).json({ message: "Email sent via SendGrid" });
  } catch (error) {
    console.error("❌ SendGrid error:", error.response?.body || error.message);
    res.status(500).send("Failed to send email.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SendGrid email server running on port ${PORT}`);
});
