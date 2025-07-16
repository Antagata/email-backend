// email-backend/server.js (Resend version)
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
const upload = multer({ dest: "uploads/" });

const resend = new Resend(process.env.RESEND_API_KEY);

app.post("/send", upload.fields([
  { name: "quoteFile" },
  { name: "conversationFile" }
]), async (req, res) => {
  const { emailBody, subject, recipientEmail, conversationLink } = req.body;
  const quoteFile = req.files["quoteFile"]?.[0];
  const convFile = req.files["conversationFile"]?.[0];

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

    let fullBody = emailBody;
    if (conversationLink) {
      fullBody += `\n\nConversation Link: ${conversationLink}`;
    }

    await resend.emails.send({
      from: process.env.RESEND_SENDER,
      to: recipientEmail,
      subject,
      text: fullBody,
      attachments,
    });

    if (quoteFile) fs.unlinkSync(quoteFile.path);
    if (convFile) fs.unlinkSync(convFile.path);

    res.status(200).send("✅ Email sent via Resend");
  } catch (error) {
    console.error("❌ Resend error:", error);
    res.status(500).send("Failed to send email.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Resend email server running on port ${PORT}`);
});
