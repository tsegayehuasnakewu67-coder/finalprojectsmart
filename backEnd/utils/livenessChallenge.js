const mongoose = require('mongoose');
const { randomInt } = require('node:crypto');
const LivenessChallenge = require('../models/LivenessChallenge');

const CHALLENGE_LIFETIME_MS = 60_000;
const MIN_DURATION_MS = 1_000;
const MAX_DURATION_MS = CHALLENGE_LIFETIME_MS;
const MIN_OBSERVED_FRAMES = 3;
const MAX_OBSERVED_FRAMES = 120;

const issueLivenessChallenge = async (_req, res) => {
  try {
    const action = randomInt(0, 2) === 0 ? 'blink' : 'turn';
    const expiresAt = new Date(Date.now() + CHALLENGE_LIFETIME_MS);
    const challenge = await LivenessChallenge.create({ action, expiresAt });
    return res.status(201).json({
      success: true,
      data: {
        challengeId: challenge.id,
        action,
        expiresAt: challenge.expiresAt,
      },
    });
  } catch (error) {
    console.error('Unable to issue attendance liveness challenge:', error);
    return res.status(500).json({ success: false, message: 'Unable to start the camera verification. Please try again.' });
  }
};

const consumeLivenessChallenge = async (proof) => {
  const { challengeId, action, durationMs, observedFrames } = proof || {};
  if (
    typeof challengeId !== 'string'
    || !mongoose.isValidObjectId(challengeId)
    || !['blink', 'turn'].includes(action)
    || !Number.isInteger(durationMs)
    || durationMs < MIN_DURATION_MS
    || durationMs > MAX_DURATION_MS
    || !Number.isInteger(observedFrames)
    || observedFrames < MIN_OBSERVED_FRAMES
    || observedFrames > MAX_OBSERVED_FRAMES
  ) {
    return false;
  }

  const now = new Date();
  const challenge = await LivenessChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      action,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { new: true },
  );
  return Boolean(challenge);
};

module.exports = { issueLivenessChallenge, consumeLivenessChallenge };
