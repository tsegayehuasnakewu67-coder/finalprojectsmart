const router = require('express').Router();
const {
  register, login, getMe, logout, signup, setupAdmin,
  changePassword, forgotPassword, resetPassword,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/requestValidation');
const { loginRateLimit } = require('../middleware/apiSecurity');

// Public routes
router.post('/login', loginRateLimit, [
  body('identifier').optional().isString().trim().isLength({ min: 1, max: 254 }),
  body('email').optional().isString().trim().isLength({ min: 1, max: 254 }),
  body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('Password is required.'),
], validateRequest, login);
router.post('/forgot-password', loginRateLimit, [
  body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
], validateRequest, forgotPassword);
router.post('/reset-password', loginRateLimit, [
  body('token').isString().isLength({ min: 64, max: 64 }),
  body('newPassword').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 12, max: 128 }),
], validateRequest, resetPassword);
router.post('/change-password', protect, [
  body('currentPassword').isString().notEmpty().isLength({ max: 128 }),
  body('newPassword').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().isLength({ min: 12, max: 128 }),
], validateRequest, changePassword);
router.post('/signup', [
  body('fullName').isString().trim().isLength({ min: 2, max: 201 }),
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 128 }),
  body('confirmPassword').isString().notEmpty(),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }),
  body('position').isString().trim().isLength({ min: 2, max: 100 }),
], validateRequest, signup);        // self-registration — employee only
router.post('/setup-admin', [
  body('fullName').isString().trim().isLength({ min: 2, max: 201 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 12, max: 128 }),
  body('confirmPassword').isString().notEmpty(),
], validateRequest, setupAdmin);    // first-time admin creation — blocked after first admin exists

// Admin-only registration (can set any role)
router.post('/register', protect, adminOnly, [
  body('fullName').isString().trim().isLength({ min: 2, max: 201 }),
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('email').isEmail().normalizeEmail(),
  body('password').optional().isString().isLength({ max: 128 }),
  body('role').optional().isIn(['employee', 'hr', 'admin']),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }),
  body('position').isString().trim().isLength({ min: 2, max: 100 }),
  body('confirmPassword').optional().isString().isLength({ max: 128 }),
  body('faceDescriptor').optional().isArray({ min: 128, max: 128 }),
  body('faceDescriptor.*').optional().isFloat({ min: -2, max: 2 }),
], validateRequest, register);

// Protected
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
