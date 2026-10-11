const rateLimit = require('express-rate-limit');
const FaceScanAttempt = require('../models/FaceScanAttempt');

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/face/bulk-register',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    message: 'Too many requests. Please try again later.',
  },
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' },
    message: 'Too many sign-in attempts. Please try again later.',
  },
});

const attendanceScanRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Number.parseInt(process.env.ATTENDANCE_SCAN_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    try {
      await FaceScanAttempt.create({
        outcome: 'rate_limited',
        reason: 'rate_limited',
        ipAddress: String(req.ip || '').slice(0, 64),
        deviceInfo: String(req.get('user-agent') || '').slice(0, 300),
      });
    } catch (error) {
      console.error('Unable to persist rate-limited face-scan audit event:', error);
    }
    const message = 'Too many scan attempts. Please wait before trying again.';
    return res.status(429).json({
      success: false,
      error: { code: 'SCAN_RATE_LIMITED', message },
      message,
    });
  },
});

const bulkFaceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number.parseInt(process.env.FACE_REGISTER_RATE_LIMIT_MAX, 10) || 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOptions = () => {
  const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
};

module.exports = {
  apiRateLimit, loginRateLimit, attendanceScanRateLimit, bulkFaceRateLimit, corsOptions,
};
