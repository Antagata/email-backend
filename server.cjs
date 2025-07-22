// email-backend/server.cjs (SendGrid version with attachments and CC)
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

// SALESPERSON_EMAIL_MAP (duplicate from frontend for consistency)
const SALESPERSON_EMAIL_MAP = {
  "a.saurina": "alberto.saurina@avu.eu",
  "n.huerga": "Natalia.Huerga@avu.eu",
  "a.ronnenberg": "anna.ronnenberg@avu.wine",
  "a.anedda": "anna.anedda@avu.wine",
  "a.perros": "Alexandros.Perros@avu.wine",
  "a.veronesi": "Alessandra.Veronesi@avu.wine",
  "c.boccato": "Camilla.Boccato@avu.wine",
  "c.netter": "christina.netter@avu.wine",
  "f.frontini": "fabio.frontini@avu.wine",
  "f.sempol": "francois.sempol@avu.wine",
  "g.bevilacqua": "giacomo.bevilacqua@avu.wine",
  "m.bellone": "massimiliano.bellone@avu.wine",
  "n.boldrini": "nicolas.boldrini@avu.wine",
  "a.mascheroni": "Alberto.Mascheroni@avu.wine",
  "r.aragón": "raul.aragon@avu.eu",
  "v.vargiu": "Valentina.Vargiu@avu.wine",
  "d.gatto": "debora.gatto@avu.wine",
  "f.hutter": "Fabienne.Hutter@avu.wine",
  "m.africani": "marco.africani@avu.wine",
  "p.leroux": "Pierre.Leroux@avu.wine",
  "a.mauracher": "Ariane.Mauracher@avu.wine",
  "d.huber": "david.huber@avu.wine",
  "GuestQEX": "logistics@avu.wine"
};

app.post("/send", upload.fields([
  { name: "quoteFile" },
  { name: "conversation" }
]), async (req, res) => {
  console.log("📥 Received POST /send");

  const { message, subject, conversationLink, sender } = req.body;
  const quoteFile = req.files["quoteFile"]?.[0];
  const convFile = req.files["conversation"]?.[0];

  const finalTo = "export@avu.wine";
  const defaultEmail = "logistics@avu.wine";

  // Extract salesperson ID from email if possible
  const salespersonId = sender?.split('@')[0]?.toLowerCase() || "guestqex";
  const mappedSenderEmail = SALESPERSON_EMAIL_MAP[salespersonId] || defaultEmail;

  console.log("🧭 Sender ID:", salespersonId);
  console.log("📧 From:", mappedSenderEmail);

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
    from: mappedSenderEmail,
    cc: mappedSenderEmail,
    replyTo: mappedSenderEmail,
    subject,
    text: fullBody,
    attachments,
  };

  try {
    console.log("📤 Sending email payload via SendGrid:", {
      to: finalTo,
      from: emailPayload.from,
      cc: emailPayload.cc,
      replyTo: emailPayload.replyTo,
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
