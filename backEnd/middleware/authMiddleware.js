
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const getBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== 'bearer' || !token) return null;

  return token;
};

const protect = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ success: false, message: 'User no longer exists.' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated.' });
    if ((decoded.authVersion ?? 0) !== (user.authVersion ?? 0)) {
      return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    }

    const requestPath = `${req.baseUrl}${req.path}`;
    const passwordChangeAllowed = requestPath === '/api/auth/me'
      || requestPath === '/api/auth/change-password';
    if ((decoded.passwordChangeOnly || user.mustChangePassword) && !passwordChangeAllowed) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'For your account security, please change your default password before continuing.',
      });
    }

    req.user = user;
    req.tokenClaims = decoded;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

const adminOrHR = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'hr') return next();
  return res.status(403).json({ success: false, message: 'Admin or HR access required.' });
};

const employeeOrAdmin = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.role === 'employee') return next();
  return res.status(403).json({ success: false, message: 'Forbidden.' });
};

module.exports = { protect, adminOnly, adminOrHR, employeeOrAdmin };
