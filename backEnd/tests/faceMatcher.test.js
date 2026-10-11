const test = require('node:test');
const assert = require('node:assert/strict');
const Attendance = require('../models/Attendance');
const LivenessChallenge = require('../models/LivenessChallenge');
const {
  euclideanDistance,
  findBestMatch,
  isValidFaceDescriptor,
} = require('../utils/faceMatcher');
const { consumeLivenessChallenge } = require('../utils/livenessChallenge');

const zeroDescriptor = () => Array(128).fill(0);

test('accepts only finite, bounded 128-value face descriptors', () => {
  assert.equal(isValidFaceDescriptor(zeroDescriptor()), true);
  assert.equal(isValidFaceDescriptor([...zeroDescriptor(), 0]), false);
  assert.equal(isValidFaceDescriptor(Array(128).fill(Number.NaN)), false);
  assert.equal(isValidFaceDescriptor(Array(128).fill(2.01)), false);
});

test('computes Euclidean descriptor distance and rejects invalid dimensions', () => {
  const oneOffset = zeroDescriptor();
  oneOffset[0] = 0.25;
  assert.equal(euclideanDistance(zeroDescriptor(), oneOffset), 0.25);
  assert.equal(euclideanDistance([0], [0]), Infinity);
});

test('selects the nearest employee and strictly rejects distance 0.6', () => {
  const justInside = zeroDescriptor();
  justInside[0] = 0.5999;
  const atLimit = zeroDescriptor();
  atLimit[0] = 0.6;
  const employee = { employeeId: 'NEAR', faceDescriptor: justInside };

  assert.deepEqual(findBestMatch(zeroDescriptor(), [employee]), {
    matched: true,
    employee,
    distance: 0.5999,
  });
  assert.equal(findBestMatch(zeroDescriptor(), [{ employeeId: 'LIMIT', faceDescriptor: atLimit }]).matched, false);
});

test('attendance schema has scan metadata and daily user uniqueness indexes', () => {
  const indexes = Attendance.schema.indexes();
  assert.ok(indexes.some(([keys]) => keys.userId === 1 && keys.timestamp === -1));
  assert.ok(indexes.some(([keys, options]) => (
    keys.userId === 1
    && keys.date === 1
    && options.unique === true
    && options.partialFilterExpression?.userId?.$type === 'objectId'
  )));
  assert.ok(Attendance.schema.path('livenessScore'));
});

test('accepts a newly issued liveness challenge immediately', async () => {
  const original = LivenessChallenge.findOneAndUpdate;
  let receivedFilter = null;

  LivenessChallenge.findOneAndUpdate = async (filter) => {
    receivedFilter = filter;
    return { _id: '507f191e810c19729de860ea' };
  };

  try {
    const accepted = await consumeLivenessChallenge({
      challengeId: '507f191e810c19729de860ea',
      action: 'blink',
      durationMs: 1500,
      observedFrames: 5,
    });

    assert.equal(accepted, true);
    assert.equal(receivedFilter.createdAt, undefined);
    assert.equal(receivedFilter.consumedAt, null);
  } finally {
    LivenessChallenge.findOneAndUpdate = original;
  }
});

test('accepts liveness proof duration up to the 60-second challenge lifetime', async () => {
  const original = LivenessChallenge.findOneAndUpdate;
  LivenessChallenge.findOneAndUpdate = async () => ({ _id: '507f191e810c19729de860ea' });

  try {
    const accepted = await consumeLivenessChallenge({
      challengeId: '507f191e810c19729de860ea',
      action: 'blink',
      durationMs: 60_000,
      observedFrames: 5,
    });
    assert.equal(accepted, true);
  } finally {
    LivenessChallenge.findOneAndUpdate = original;
  }
});
