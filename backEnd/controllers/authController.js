const jwt  = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { findDuplicateFace } = require('../utils/faceRegistration');
const { syncEmployeeForUser } = require('../utils/employeeSync');
const { invalidateFaceCandidates } = require('../services/faceRecognitionService');
const { sendPasswordResetEmail, isPasswordResetEmailConfigured } = require('../services/emailService');
const { getDefaultEmployeePassword, validatePassword } = require('../utils/passwordPolicy');

const signToken = (user, passwordChangeOnly = false) =>
  jwt.sign({
    id: user._id,
    role: user.role,
    authVersion: user.authVersion || 0,
    ...(passwordChangeOnly ? { passwordChangeOnly: true } : {}),
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safeUser = (u) => ({
  _id:               u._id,
  name:              u.name || u.fullName,
  fullName:          u.fullName,
  employeeId:        u.employeeId,
  email:             u.email,
  department:        u.department,
  position:          u.position,
  role:              u.role,
  isActive:          u.isActive,
  mustChangePassword: Boolean(u.mustChangePassword),
  passwordChangedAt: u.passwordChangedAt || null,
  hasFace:           u.faceDescriptor?.length === 128,
  createdAt:         u.createdAt,
});

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issuePasswordReset = async (user) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  try {
    await sendPasswordResetEmail({ email: user.email, name: user.fullName, token });
  } catch (error) {
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    throw error;
  }
};

/**
 * Check if a face descriptor is already registered to another user.
 * Excludes `excludeId` so edit-mode doesn't flag the same user's own face.
 * Returns { duplicate: true, owner } or { duplicate: false }
 */
// POST /api/auth/register  (admin only)
const register = async (req, res) => {
  try {
    const {
      fullName, employeeId, email, password, confirmPassword,
      department, position, role, faceDescriptor,
    } = req.body;
    const accountRole = ['admin', 'hr'].includes(role) ? role : 'employee';

    if (!fullName || !employeeId || !email || !department || !position
      || (accountRole !== 'employee' && !password)) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (typeof position !== 'string' || position.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Position title must be at least 2 characters long.' });
    }
    if (accountRole !== 'employee' && confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (accountRole !== 'employee') {
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    }
    if (faceDescriptor !== undefined && (
      !Array.isArray(faceDescriptor)
      || faceDescriptor.length !== 128
      || !faceDescriptor.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2)
    )) {
      return res.status(400).json({ success: false, message: 'Face descriptor must be 128 numbers.' });
    }

    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { employeeId: employeeId.toUpperCase() }],
    });
    if (exists) {
      const field = exists.email === email.toLowerCase() ? 'Email' : 'Employee ID';
      return res.status(409).json({ success: false, message: `${field} already registered.` });
    }

    // ── Face duplicate check ──────────────────────────────
    if (faceDescriptor && faceDescriptor.length === 128) {
      const owner = await findDuplicateFace(faceDescriptor, { excludeEmployeeCode: employeeId });
      if (owner) {
        return res.status(409).json({
          success: false,
          message: `This face is already registered to "${owner.fullName}" (ID: ${owner.employeeId}). Each employee must use their own unique face.`,
        });
      }
    }

    const employeePassword = accountRole === 'employee' ? getDefaultEmployeePassword() : password;
    const user = await User.create({
      name:           fullName.trim(),
      fullName: fullName.trim(),
      employeeId: employeeId.toUpperCase().trim(),
      email: email.toLowerCase().trim(),
      password: employeePassword,
      department: department.trim(),
      position: position.trim(),
      role: accountRole,
      mustChangePassword: accountRole === 'employee',
      passwordChangedAt: accountRole === 'employee' ? null : new Date(),
      faceDescriptor: faceDescriptor || [],
    });
    await syncEmployeeForUser(user);
    invalidateFaceCandidates();

    return res.status(201).json({
      success: true,
      message: accountRole === 'employee'
        ? `Employee "${user.fullName}" registered. They must change the configured default password after signing in.`
        : `Employee "${user.fullName}" registered.`,
      data: { user: safeUser(user) },
    });
  } catch (err) {
    if (/DEFAULT_EMPLOYEE_PASSWORD/.test(err.message)) {
      return res.status(503).json({ success: false, message: 'Employee account creation is not configured on the server.' });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID or email and password are required.' });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { employeeId: identifier.toUpperCase() },
      ],
    }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is inactive. Contact an administrator.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser(user),
        token: signToken(user, user.mustChangePassword),
      },
    });
  } catch (err) {
    const databaseUnavailable = mongoose.connection.readyState !== 1
      || ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerSelectionError'].includes(err.name);
    if (databaseUnavailable) {
      console.error('Login unavailable because the database connection failed.');
      return res.status(503).json({ success: false, message: 'The account database is unavailable. Please try again shortly.' });
    }
    console.error('Login error:', err.name);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const logout = (_req, res) => res.json({ success: true, message: 'Logged out successfully.' });

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Current password, new password, and confirmation are required.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !await user.comparePassword(currentPassword)) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, password: user.password },
      { $set: {
        password: await bcrypt.hash(newPassword, 12),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        authVersion: (user.authVersion || 0) + 1,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      } },
      { new: true, runValidators: true },
    );
    if (!updatedUser) {
      return res.status(409).json({ success: false, message: 'Password was changed by another request. Sign in and try again.' });
    }

    return res.json({
      success: true,
      message: 'Password changed successfully.',
      data: { user: safeUser(updatedUser), token: signToken(updatedUser) },
    });
  } catch (error) {
    console.error('Change-password request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to change password right now.' });
  }
};

// POST /api/auth/forgot-password. The same response is used whether or not the
// account exists to avoid disclosing registered email addresses.
const forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists, reset instructions may be sent to its registered email. This response does not confirm email delivery.';
  if (!isPasswordResetEmailConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Password reset email is not configured. Contact your system administrator.',
    });
  }
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (user) {
      try {
        await issuePasswordReset(user);
      } catch (error) {
        console.error('Password reset email delivery failed.', { name: error.name, code: error.code });
      }
    }
    return res.json({ success: true, message: genericMessage });
  } catch (error) {
    const databaseUnavailable = mongoose.connection.readyState !== 1
      || ['MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerSelectionError'].includes(error.name);
    if (databaseUnavailable) {
      return res.status(503).json({ success: false, message: 'The account database is unavailable. Please try again shortly.' });
    }
    console.error('Forgot-password request failed:', error.name);
    return res.status(500).json({ success: false, message: 'Unable to process password reset right now.' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }
    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+password +passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const updatedUser = await User.findOneAndUpdate({
      _id: user._id,
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }, {
      $set: {
        password: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        authVersion: (user.authVersion || 0) + 1,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or expired.' });
    }
    return res.json({ success: true, message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to reset password right now.' });
  }
};

// POST /api/auth/admin-reset/:id — restricted to an authenticated administrator.
const adminResetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (user.role === 'employee') {
      user.password = getDefaultEmployeePassword();
      user.mustChangePassword = true;
      user.passwordChangedAt = null;
      user.authVersion = (user.authVersion || 0) + 1;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      await user.save();
      return res.json({
        success: true,
        message: 'Employee password reset. The employee must use the configured default password and change it before continuing.',
      });
    }

    await issuePasswordReset(user);
    return res.json({ success: true, message: 'Password reset instructions sent to the account email address.' });
  } catch (error) {
    if (/DEFAULT_EMPLOYEE_PASSWORD/.test(error.message)) {
      return res.status(503).json({ success: false, message: 'Employee password reset is not configured on the server.' });
    }
    console.error('Administrator password reset request failed:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to send password reset instructions. Check server email configuration.' });
  }
};

// POST /api/auth/signup  — public self-registration (role always 'employee')
const signup = async (req, res) => {
  try {
    const {
      fullName, employeeId, email, password, confirmPassword,
      department, position, faceDescriptor,
    } = req.body;

    if (!fullName || !employeeId || !email || !password || !department || !position) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (typeof position !== 'string' || position.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Position title must be at least 2 characters long.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (faceDescriptor !== undefined && (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128)) {
      return res.status(400).json({ success: false, message: 'Face descriptor must be 128 numbers.' });
    }

    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { employeeId: employeeId.toUpperCase() }],
    });
    if (exists) {
      const field = exists.email === email.toLowerCase() ? 'Email' : 'Employee ID';
      return res.status(409).json({ success: false, message: `${field} already registered.` });
    }

    // ── Face duplicate check ──────────────────────────────
    if (faceDescriptor && faceDescriptor.length === 128) {
      const { duplicate, owner } = await checkFaceDuplicate(faceDescriptor);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `This face is already registered to "${owner.fullName}" (ID: ${owner.employeeId}). Each person can only register their own face.`,
        });
      }
    }

    const user = await User.create({
      name:           fullName.trim(),
      fullName:       fullName.trim(),
      employeeId:     employeeId.toUpperCase().trim(),
      email:          email.toLowerCase().trim(),
      password,
      department:     department.trim(),
      position:       position.trim(),
      role:           'employee',          // public signup always employee
      faceDescriptor: faceDescriptor || [],
    });
    await syncEmployeeForUser(user);
    invalidateFaceCandidates();

    return res.status(201).json({
      success: true,
      message: `Account created for "${user.fullName}". You can now sign in.`,
      data: { user: safeUser(user), token: signToken(user._id, user.role) },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
};

// POST /api/auth/setup-admin  — first-time admin creation (blocked if any admin exists)
const setupAdmin = async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Setup already complete. An admin account already exists.',
      });
    }

    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });

    // Auto-generate a unique admin employeeId that never conflicts with employees
    const adminEmployeeId = `ADMIN-${Date.now()}`;

    const user = await User.create({
      name:       fullName.trim(),
      fullName:   fullName.trim(),
      employeeId: adminEmployeeId,
      email:      email.toLowerCase().trim(),
      password,
      department: 'Administration',
      position:   'System Administrator',
      role:       'admin',
    });

    return res.status(201).json({
      success: true,
      message: `Admin account created for "${user.fullName}". You can now sign in.`,
      data: { user: safeUser(user) },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `${field} already exists.` });
    }
    console.error('SetupAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error during admin setup.' });
  }
};

module.exports = {
  register, login, getMe, logout, signup, setupAdmin,
  changePassword, forgotPassword, resetPassword, adminResetPassword,
};
