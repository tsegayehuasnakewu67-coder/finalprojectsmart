const mongoose = require('mongoose');

const livenessChallengeSchema = new mongoose.Schema({
  action: { type: String, enum: ['blink', 'turn'], required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

livenessChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LivenessChallenge', livenessChallengeSchema);
