const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword, getDefaultEmployeePassword, PASSWORD_MIN_LENGTH } = require('../utils/passwordPolicy');

test('password policy accepts a long password with all required character classes', () => {
  assert.equal(validatePassword('Strong-Employee-123!'), null);
});

test('password policy rejects short or incomplete passwords', () => {
  assert.match(validatePassword('Welcome123!'), /between/);
  assert.match(validatePassword('welcome-employee-123'), /uppercase/);
});

test('default employee password is read from the backend environment and validated', () => {
  const previous = process.env.DEFAULT_EMPLOYEE_PASSWORD;
  process.env.DEFAULT_EMPLOYEE_PASSWORD = 'Strong-Employee-123!';
  assert.equal(getDefaultEmployeePassword(), 'Strong-Employee-123!');
  process.env.DEFAULT_EMPLOYEE_PASSWORD = '   Strong-Employee-123!\n';
  assert.equal(getDefaultEmployeePassword(), 'Strong-Employee-123!');
  process.env.DEFAULT_EMPLOYEE_PASSWORD = 'weak';
  assert.throws(() => getDefaultEmployeePassword(), /DEFAULT_EMPLOYEE_PASSWORD/);
  if (previous === undefined) delete process.env.DEFAULT_EMPLOYEE_PASSWORD;
  else process.env.DEFAULT_EMPLOYEE_PASSWORD = previous;
  assert.equal(PASSWORD_MIN_LENGTH, 12);
});
