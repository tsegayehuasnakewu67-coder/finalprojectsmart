const nodemailer = require('nodemailer');

const normalizeEnvValue = (value) => (typeof value === 'string' ? value.trim() : '');

const isPasswordResetEmailConfigured = () => Boolean(
  normalizeEnvValue(process.env.MAIL_HOST)
  && normalizeEnvValue(process.env.MAIL_USER)
  && normalizeEnvValue(process.env.MAIL_PASSWORD)
  && normalizeEnvValue(process.env.MAIL_FROM),
);

const createTransport = () => {
  const host = normalizeEnvValue(process.env.MAIL_HOST);
  const user = normalizeEnvValue(process.env.MAIL_USER);
  const pass = normalizeEnvValue(process.env.MAIL_PASSWORD);
  if (!isPasswordResetEmailConfigured()) {
    throw new Error('Password reset email is not configured.');
  }

  const port = Number.parseInt(process.env.MAIL_PORT, 10) || 587;
  return nodemailer.createTransport({
    host,
    port,
    secure: normalizeEnvValue(process.env.MAIL_SECURE) === 'true',
    auth: { user, pass },
  });
};

const sendPasswordResetEmail = async ({ email, name, token }) => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Smart Attendance password reset',
    text: `Hello ${name || 'there'},\n\nUse this single-use link within 15 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
  });
};

module.exports = { sendPasswordResetEmail, isPasswordResetEmailConfigured };
