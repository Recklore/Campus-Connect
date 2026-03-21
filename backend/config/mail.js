const nodeMailer = require("nodemailer");

require("dotenv").config();

const transporter = nodeMailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: { user: process.env.MAIL_ID, pass: process.env.MAIL_PASS },
});

const sendVerificationMail = (to, mailData) => {
  transporter.sendMail({
    to: to,
    subject: mailData.subject,
    html: mailData.html,
  });
};

module.exports = { sendVerificationMail };
