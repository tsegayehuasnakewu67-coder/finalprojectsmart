const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { forgotPassword, resetPassword } = require('../controllers/authController');
const { isPasswordResetEmailConfigured } = require('../services/emailService');

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('forgot-password reports unavailable when SMTP is not configured without looking up email', async () => {
  const originalFindOne = User.findOne;
  const previous = Object.fromEntries(
    ['MAIL_HOST', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_FROM'].map((key) => [key, process.env[key]]),
  );
  for (const key of Object.keys(previous)) delete process.env[key];
  User.findOne = async () => {
    throw new Error('Email lookup must not occur when delivery is unconfigured.');
  };

  try {
    assert.equal(isPasswordResetEmailConfigured(), false);
    const res = responseMock();
    await forgotPassword({ body: { email: 'admin@example.test' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /email is not configured/i);
  } finally {
    User.findOne = originalFindOne;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('expired or previously used reset token is rejected', async () => {
  const originalFindOne = User.findOne;
  User.findOne = () => ({ select: async () => null });

  try {
    const res = responseMock();
    await resetPassword({
      body: {
        token: 'a'.repeat(64),
        newPassword: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      },
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /invalid or expired/i);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('valid reset token updates the password hash and cannot be reused', async () => {
  const originalFindOne = User.findOne;
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  let lookups = 0;
  let atomicFilter;
  let atomicUpdate;
  const existingUser = {
    _id: '507f191e810c19729de860ea',
    password: '$2a$existing-hash',
    authVersion: 3,
    comparePassword: async () => false,
  };
  const updatedUser = {
    ...existingUser,
    passwordChangedAt: new Date(),
    mustChangePassword: false,
    authVersion: 4,
  };
  User.findOne = () => ({
    select: async () => {
      lookups += 1;
      return lookups === 1 ? existingUser : null;
    },
  });
  User.findOneAndUpdate = async (filter, update) => {
    atomicFilter = filter;
    atomicUpdate = update;
    return updatedUser;
  };

  try {
    const body = {
      token: 'b'.repeat(64),
      newPassword: 'NewStrongPassword123!',
      confirmPassword: 'NewStrongPassword123!',
    };
    const res = responseMock();
    await resetPassword({ body }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(atomicFilter._id, existingUser._id);
    assert.equal(atomicFilter.passwordResetTokenHash.length, 64);
    assert.ok(atomicFilter.passwordResetExpiresAt.$gt instanceof Date);
    assert.equal(await bcrypt.compare(body.newPassword, atomicUpdate.$set.password), true);
    assert.equal(atomicUpdate.$set.passwordResetTokenHash, null);
    assert.equal(atomicUpdate.$set.passwordResetExpiresAt, null);
    assert.equal(atomicUpdate.$set.authVersion, 4);

    const reuseResponse = responseMock();
    await resetPassword({ body }, reuseResponse);
    assert.equal(reuseResponse.statusCode, 400);
    assert.match(reuseResponse.body.message, /invalid or expired/i);
  } finally {
    User.findOne = originalFindOne;
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
