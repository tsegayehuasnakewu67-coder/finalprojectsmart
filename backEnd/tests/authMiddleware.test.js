const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const secret = 'unit-test-only-jwt-secret-that-is-long-enough';
process.env.JWT_SECRET = secret;

const requestFor = (path, claims = {}) => ({
  headers: { authorization: `Bearer ${jwt.sign({ id: 'test-user', authVersion: 0, ...claims }, secret)}` },
  baseUrl: path.startsWith('/api/auth') ? '/api/auth' : '/api/attendance',
  path: path.replace(/^\/api\/(?:auth|attendance)/, '') || '/',
});

const responseMock = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('must-change account cannot access protected attendance APIs', async () => {
  const original = User.findById;
  User.findById = async () => ({ isActive: true, mustChangePassword: true, authVersion: 0, role: 'employee' });
  try {
    const req = requestFor('/api/attendance/my');
    const res = responseMock();
    let called = false;
    await protect(req, res, () => { called = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal(called, false);
  } finally {
    User.findById = original;
  }
});

test('must-change account can load its safe identity and change-password endpoint', async () => {
  const original = User.findById;
  User.findById = async () => ({ isActive: true, mustChangePassword: true, authVersion: 0, role: 'employee' });
  try {
    for (const path of ['/api/auth/me', '/api/auth/change-password']) {
      const req = requestFor(path, { passwordChangeOnly: true });
      const res = responseMock();
      let called = false;
      await protect(req, res, () => { called = true; });
      assert.equal(called, true, path);
      assert.equal(req.user.role, 'employee');
    }
  } finally {
    User.findById = original;
  }
});

test('password change increments invalidate old sessions', async () => {
  const original = User.findById;
  User.findById = async () => ({ isActive: true, mustChangePassword: false, authVersion: 1, role: 'employee' });
  try {
    const req = requestFor('/api/attendance/my');
    req.headers.authorization = `Bearer ${jwt.sign({ id: 'test-user', authVersion: 0 }, secret)}`;
    const res = responseMock();
    let called = false;
    await protect(req, res, () => { called = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(called, false);
  } finally {
    User.findById = original;
  }
});
