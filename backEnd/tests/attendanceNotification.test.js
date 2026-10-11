const test = require('node:test');
const assert = require('node:assert/strict');
const Notification = require('../models/Notification');
const { notifyAttendanceEvent, resolveSessionAction } = require('../controllers/attendanceController');
const { createAddisAbabaDateTime } = require('../utils/ethiopianTime');

test('notification persistence failure does not turn a recorded attendance scan into an API failure', async () => {
  const originalCreate = Notification.create;
  const originalError = console.error;
  let loggedFailure = false;
  Notification.create = async () => {
    throw Object.assign(new Error('Notification storage unavailable.'), {
      name: 'MongoServerError',
      code: 91,
    });
  };
  console.error = (message, metadata) => {
    loggedFailure = message.includes('Attendance was recorded')
      && metadata.name === 'MongoServerError'
      && metadata.code === 91;
  };

  try {
    await assert.doesNotReject(notifyAttendanceEvent(
      { _id: '507f191e810c19729de860ea', fullName: 'Test Employee' },
      { notifyCheckIn: true },
      'check-in',
      { time: new Date(), status: 'Present', lateMinutes: 0 },
    ));
    assert.equal(loggedFailure, true);
  } finally {
    Notification.create = originalCreate;
    console.error = originalError;
  }
});

test('after-hours scan cannot create a new attendance record but existing attendance can be checked out', () => {
  const shift = {
    startHour: 8,
    startMinute: 30,
    endHour: 17,
    endMinute: 0,
    lunchEnabled: false,
  };
  const afterShift = createAddisAbabaDateTime('2026-10-10', 17, 1);

  assert.equal(resolveSessionAction(null, afterShift, shift), 'closed');
  assert.equal(resolveSessionAction({
    checkOutTime: null,
    afterLunchCheckIn: null,
    afterLunchCheckOut: null,
  }, afterShift, shift), 'auto_checkout');
});
