const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
  return res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details },
    message: 'Request validation failed.',
  });
};

const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;
  const code = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_TOTAL_SIZE'
    ? 'FILE_TOO_LARGE'
    : status < 500 ? error.code || 'REQUEST_ERROR' : 'INTERNAL_SERVER_ERROR';
  const message = status < 500
    ? error.message || 'Request could not be processed.'
    : 'An unexpected server error occurred.';
  if (status >= 500) console.error('Unhandled API error:', error);
  return res.status(status).json({
    success: false,
    error: { code, message },
    message,
  });
};

const notFoundHandler = (req, res) => {
  const message = `${req.method} ${req.originalUrl} not found.`;
  return res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message },
    message,
  });
};

module.exports = { validateRequest, errorHandler, notFoundHandler };
