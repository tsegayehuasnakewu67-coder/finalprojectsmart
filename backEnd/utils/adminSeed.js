const User = require('../models/User');
const { validatePassword } = require('./passwordPolicy');

const ensureAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = (process.env.ADMIN_NAME || 'System Administrator').trim();

  if (!email) throw new Error('ADMIN_EMAIL is required in backEnd/.env.');

  const configuredAccount = await User.findOne({ email });
  if (configuredAccount) {
    if (configuredAccount.role !== 'admin') {
      throw new Error('ADMIN_EMAIL is already assigned to a non-admin account.');
    }
    if (!configuredAccount.isActive) {
      configuredAccount.isActive = true;
      configuredAccount.authVersion = (configuredAccount.authVersion || 0) + 1;
      await configuredAccount.save();
    }
    console.log('Configured admin account is ready; existing password was not changed.');
    return configuredAccount;
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    throw new Error('An admin account already exists with a different email. Set ADMIN_EMAIL to that account after verifying it; no account or password was changed.');
  }

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(`ADMIN_PASSWORD is missing or invalid. ${passwordError}`);

  try {
    const admin = await User.create({
      name,
      fullName: name,
      employeeId: `ADMIN-${Date.now()}`,
      email,
      password,
      department: 'Administration',
      position: 'System Administrator',
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    });
    console.log('Admin account created successfully');
    return admin;
  } catch (error) {
    if (error.code === 11000) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        console.log('Admin account already exists');
        return admin;
      }
    }
    throw error;
  }
};

module.exports = ensureAdmin;
