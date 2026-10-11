const mongoose = require('mongoose');

const faceScanAttemptSchema = new mongoose.Schema({
  outcome: { type: String, enum: ['failed', 'rate_limited'], required: true },
  reason: {
    type: String,
    enum: ['invalid_descriptor', 'liveness_failed', 'no_registered_faces', 'unknown_face', 'server_error', 'rate_limited'],
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  employeeId: { type: String, maxlength: 64, default: '' },
  distance: { type: Number, default: null },
  ipAddress: { type: String, maxlength: 64, default: '' },
  deviceInfo: { type: String, maxlength: 300, default: '' },
}, { timestamps: true });

faceScanAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
faceScanAttemptSchema.index({ reason: 1, createdAt: -1 });

module.exports = mongoose.model('FaceScanAttempt', faceScanAttemptSchema);
