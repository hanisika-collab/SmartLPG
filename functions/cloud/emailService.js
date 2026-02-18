const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS } = require("../env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER.value(),
    pass: EMAIL_PASS.value()
  }
});



async function sendEmail(to, subject, text) {
try {
await transporter.sendMail({
from: `"Smart LPG System" <${EMAIL_USER}>`,
to,
subject,
text
});


console.log("✅ Email sent to", to);
} catch (err) {
console.error("❌ Email error:", err);
}
}
module.exports = { sendEmail };