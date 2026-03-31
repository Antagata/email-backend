// email-backend/server.cjs
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
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

const SALESPERSON_EMAIL_MAP = {
  "a.saurina": "alberto.saurina@avu.eu",
  "a.ferrari": "Andrea.Ferrari@avu.wine",
  "a.ronnenberg": "anna.ronnenberg@avu.wine",
  "a.anedda": "anna.anedda@avu.wine",
  "a.perros": "Alexandros.Perros@avu.wine",
  "a.peduzzi": "Arno.Peduzzi@avu.wine",
  "a.li": "Ao.Li@avu.wine",
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
  "m.formichelli": "marc.formichelli@avu.wine",
  "d.huber": "david.huber@avu.wine",
  "n.mazzola": "Nicholas.Mazzola@avu.wine",
  "a.Garcia": "Aroa.Garcia@avu.eu",
  "GuestQEX": "logistics@avu.wine"
};

const SALESPERSON_EMAIL_MAP_LOWER = Object.fromEntries(
  Object.entries(SALESPERSON_EMAIL_MAP).map(([key, value]) => [String(key).trim().toLowerCase(), value])
);

const isTrustedInternalEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email.includes('@')) return false;
  return email.endsWith('@avu.wine') || email.endsWith('@avu.eu');
};

app.post("/send", upload.fields([
  { name: "quoteFile" },
  { name: "conversation" }
]), async (req, res) => {
  console.log("📥 Received POST /send");

  const message = req.body?.message || "";
  const subject = req.body?.subject || "No Subject";
  const conversationLink = req.body?.conversationLink || "";
  const sender = req.body?.sender || "";

  console.log("📨 Parsed fields:", { message, subject, sender, conversationLink });

  const quoteFile = req.files["quoteFile"]?.[0];
  const convFile = req.files["conversation"]?.[0];

  const finalTo = "export@avu.wine";
  const defaultEmail = "logistics@avu.wine";
  // IMPORTANT (SendGrid): `from` must be a verified Sender Identity (or domain-authenticated).
  // If we set `from` to a salesperson mailbox that isn't verified in SendGrid, SendGrid will reject
  // the request with: "The from address does not match a verified Sender Identity".
  //
  // Solution: always use a single verified `from` address, and route the salesperson mailbox via
  // `replyTo` + `cc` so replies still go back to the salesperson.
  const verifiedFromEmail = process.env.SENDGRID_FROM_EMAIL || defaultEmail;

  // Accept either a salesperson ID (e.g. "d.gatto") or an email address in `sender`.
  const normalizedSender = String(sender || "").trim();
  const senderFromId = SALESPERSON_EMAIL_MAP[normalizedSender] || SALESPERSON_EMAIL_MAP_LOWER[normalizedSender.toLowerCase()];
  const candidateSenderEmail = senderFromId || normalizedSender;

  const knownEmailsLower = new Set(
    Object.values(SALESPERSON_EMAIL_MAP)
      .filter(Boolean)
      .map(e => String(e).trim().toLowerCase())
  );

  const candidateLower = String(candidateSenderEmail).trim().toLowerCase();
  const mappedSenderEmail = (knownEmailsLower.has(candidateLower) || isTrustedInternalEmail(candidateLower))
    ? String(candidateSenderEmail).trim()
    : defaultEmail;

  console.log("🧭 Sender:", sender);
  console.log("🧭 Sender (normalized):", normalizedSender);
  console.log("📧 From:", verifiedFromEmail);
  console.log("↩️ Reply-To:", mappedSenderEmail);

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
    from: verifiedFromEmail,
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
    const errorBody = error.response?.body;
    console.error("❌ SendGrid error:", errorBody || error.message);
    res.status(500).json({
      error: "Failed to send email via SendGrid",
      details: errorBody || { message: error.message },
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SendGrid email server running on port ${PORT}`);
});
