const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const ensureAdmin = require('../utils/adminSeed');

const withAdminConfig = async (account, assertion, adminPassword = 'SafeDemoPassword123!') => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalLog = console.log;
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousPassword = process.env.ADMIN_PASSWORD;

  User.findOne = async () => account;
  User.create = async () => {
    throw new Error('An existing administrator must not be recreated.');
  };
  console.log = () => {};
  process.env.ADMIN_EMAIL = 'admin@example.test';
  process.env.ADMIN_PASSWORD = adminPassword;

  try {
    await assertion();
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    console.log = originalLog;
    if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
};

test('admin seed preserves the password of an existing active admin', async () => {
  const account = {
    role: 'admin',
    isActive: true,
    password: '$2a$existing-hash',
    authVersion: 0,
  };

  await withAdminConfig(account, async () => {
    const result = await ensureAdmin();
    assert.equal(result, account);
    assert.equal(account.password, '$2a$existing-hash');
    assert.equal(account.authVersion, 0);
  }, '');
});

test('admin seed reactivates a disabled admin and invalidates its old sessions', async () => {
  const account = {
    role: 'admin',
    isActive: false,
    password: '$2a$existing-hash',
    authVersion: 4,
    async save() {
      this.saveCalls = (this.saveCalls || 0) + 1;
    },
  };

  await withAdminConfig(account, async () => {
    await ensureAdmin();
    assert.equal(account.isActive, true);
    assert.equal(account.authVersion, 5);
    assert.equal(account.password, '$2a$existing-hash');
    assert.equal(account.saveCalls, 1);
  });
});
