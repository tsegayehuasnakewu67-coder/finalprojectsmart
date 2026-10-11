const FaceScanAttempt = require('../models/FaceScanAttempt');

const logFailedFaceScan = async (req, { reason, userId = null, employeeId = '', distance = null } = {}) => {
  try {
    await FaceScanAttempt.create({
      outcome: 'failed',
      reason,
      userId,
      employeeId,
      distance: Number.isFinite(distance) ? distance : null,
      ipAddress: String(req.ip || '').slice(0, 64),
      deviceInfo: String(req.get('user-agent') || '').slice(0, 300),
    });
  } catch (error) {
    console.error('Unable to persist failed face-scan audit event:', error);
  }
};

module.exports = { logFailedFaceScan };
