const PASSWORD_MIN_LENGTH = 12;

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    return `Password must be between ${PASSWORD_MIN_LENGTH} and 128 characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)
    || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter, a number, and a symbol.';
  }
  return null;
};

const getDefaultEmployeePassword = () => {
  const password = typeof process.env.DEFAULT_EMPLOYEE_PASSWORD === 'string'
    ? process.env.DEFAULT_EMPLOYEE_PASSWORD.trim()
    : '';
  const error = validatePassword(password);
  if (error) throw new Error(`DEFAULT_EMPLOYEE_PASSWORD is missing or invalid. ${error}`);
  return password;
};

module.exports = { PASSWORD_MIN_LENGTH, validatePassword, getDefaultEmployeePassword };
