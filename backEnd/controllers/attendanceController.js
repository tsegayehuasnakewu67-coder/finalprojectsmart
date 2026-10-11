const Attendance     = require('../models/Attendance');
const User           = require('../models/User');
const ShiftSettings  = require('../models/ShiftSettings');
const Notification   = require('../models/Notification');
const Employee       = require('../models/Employee');
const { consumeLivenessChallenge } = require('../utils/livenessChallenge');
const { recognizeFace } = require('../services/faceRecognitionService');
const { logFailedFaceScan } = require('../utils/faceScanAudit');
const { isValidFaceDescriptor } = require('../utils/faceMatcher');
const {
  getAddisAbabaDateString,
  getAddisAbabaMinutes,
  createAddisAbabaDateTime,
} = require('../utils/ethiopianTime');

/**
 * Registered department from User, never the placeholder "General".
 * Missing / blank / "General" → "Unassigned".
 */
const resolveDepartment = (value) => {
  const v = value == null ? '' : String(value).trim();
  if (!v || /^general$/i.test(v) || v === 'null' || v === 'undefined') return 'Unassigned';
  return v;
};

/**
 * Aggregation expression: prefer live User.department, then the attendance
 * snapshot, then "Unassigned". "General" is treated as missing.
 */
const DEPARTMENT_FROM_USER = {
  $let: {
    vars: {
      live: {
        $trim: {
          input: { $toString: { $ifNull: [{ $arrayElemAt: ['$_user.department', 0] }, ''] } },
        },
      },
      snap: {
        $trim: {
          input: { $toString: { $ifNull: ['$department', ''] } },
        },
      },
    },
    in: {
      $switch: {
        branches: [
          {
            case: {
              $and: [
                { $ne: ['$$live', ''] },
                { $not: { $in: [{ $toLower: '$$live' }, ['general', 'null', 'undefined']] } },
              ],
            },
            then: '$$live',
          },
          {
            case: {
              $and: [
                { $ne: ['$$snap', ''] },
                { $not: { $in: [{ $toLower: '$$snap' }, ['general', 'null', 'undefined']] } },
              ],
            },
            then: '$$snap',
          },
        ],
        default: 'Unassigned',
      },
    },
  },
};

/**
 * Fetch shift settings (falls back to hardcoded defaults if DB empty).
 */
const getShift = async () => {
  const s = await ShiftSettings.findOne({ _key: 'default' });
  return s || {
    startHour: 8, startMinute: 30, gracePeriod: 5,
    endHour: 17, endMinute: 0,
    lunchEnabled: false,
    lunchStartHour: 12, lunchStartMinute: 0, lunchDuration: 60,
    beforeLunchStartHour: 8, beforeLunchStartMinute: 30,
    beforeLunchEndHour: 12, beforeLunchEndMinute: 0,
    afterLunchStartHour: 13, afterLunchStartMinute: 0,
    afterLunchEndHour: 17, afterLunchEndMinute: 0,
    notifyCheckIn: true, notifyCheckOut: true,
  };
};

const beforeLunchStart = shift => toMins(shift.beforeLunchStartHour ?? shift.startHour, shift.beforeLunchStartMinute ?? shift.startMinute);
const beforeLunchEnd = shift => toMins(shift.beforeLunchEndHour ?? shift.lunchStartHour, shift.beforeLunchEndMinute ?? shift.lunchStartMinute);
const afterLunchStart = shift => toMins(shift.afterLunchStartHour ?? (shift.lunchStartHour + Math.floor(shift.lunchDuration / 60)), shift.afterLunchStartMinute ?? ((shift.lunchStartMinute + shift.lunchDuration) % 60));
const afterLunchEnd = shift => toMins(shift.afterLunchEndHour ?? shift.endHour, shift.afterLunchEndMinute ?? shift.endMinute);

/** Convert { hour, minute } to total minutes since midnight */
const toMins = (h, m) => h * 60 + m;

/** Format a Date to "HH:MM AM/PM" */
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }) : null;

/** Build human-readable late label, e.g. "15 min late" */
const lateLabel = (mins) =>
  mins > 0
    ? (mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m late`
        : `${mins} min late`)
    : '';

const notifyAttendanceEvent = async (employee, shift, event, details) => {
  const enabled = event === 'check-in' ? shift.notifyCheckIn !== false : shift.notifyCheckOut !== false;
  if (!enabled || !employee._id) return;
  const isLate = event === 'check-in' && details.status === 'Late';
  try {
    await Notification.create({
      recipient: employee._id,
      sender: employee._id,
      type: isLate ? 'warning' : 'message',
      subject: isLate ? 'Late attendance warning' : `Attendance ${event}`,
      message: `${employee.fullName}, your ${event} was recorded at ${fmtTime(details.time)}${isLate ? ` (${lateLabel(details.lateMinutes)}).` : '.'}${details.auto ? ' This checkout was applied automatically at the configured shift end.' : ''}`,
    });
  } catch (error) {
    console.error('Attendance was recorded, but its notification could not be saved.', {
      name: error.name,
      code: error.code,
    });
  }
};

const findAttendanceRecord = (employee, date) => Attendance.findOne(
  employee._id
    ? { userId: employee._id, date }
    : { employee: employee.employeeRef, date },
);

const claimScanWindow = async (employee, date, now) => {
  const existing = await findAttendanceRecord(employee, date);
  if (!existing) return { record: null, duplicate: false };

  const record = await Attendance.findOneAndUpdate({
    _id: existing._id,
    $or: [
      { lastScanAt: null },
      { lastScanAt: { $lte: new Date(now.getTime() - 30_000) } },
    ],
  }, {
    $set: { lastScanAt: now, timestamp: now, livenessScore: 1 },
  }, { new: true });
  return record
    ? { record, duplicate: false }
    : { record: existing, duplicate: true };
};

/**
 * Given morning check-in time and shift settings, return { status, lateMinutes }.
 * Present  → arrived within grace period
 * Late     → arrived after grace period
 */
const calcStatus = (now, shift) => {
  const arrivedMins  = getAddisAbabaMinutes(now);
  const startMins = beforeLunchStart(shift);
  const deadlineMins = startMins + (shift.gracePeriod || 0);
  if (arrivedMins <= deadlineMins) return { status: 'Present', lateMinutes: 0 };
  return { status: 'Late', lateMinutes: arrivedMins - deadlineMins };
};

/**
 * Determine what a face-scan at the kiosk should do right now for an employee.
 *
 * SESSION FLOW:
 * ─────────────────────────────────────────────────────────────────────────────
 *  Time window                  │ Kiosk action
 * ──────────────────────────────┼─────────────────────────────────────────────
 *  Before (shiftStart − 60 min) │ too_early
 *  Morning window               │ morning_checkin  (face scan → check in)
 *  Lunch start (auto, no scan)  │ [cron job bulk-checkouts everyone]
 *  Lunch window                 │ in_break  (scan shows "you're on break")
 *  After lunchEnd               │ afterlunch_checkin (face scan → check in)
 *  After-lunch session active   │ afterlunch_checkout (face scan → check out)
 *  Shift end passed, no session │ auto_checkout (system sets checkOut = shiftEnd)
 *  All sessions recorded        │ day_complete
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: 'morning_checkout' is intentionally absent — that is handled
 * automatically by the autoLunchCheckout cron job (jobs/autoLunchCheckout.js),
 * not by any manual kiosk action.
 */
const resolveSessionAction = (record, now, shift) => {
  const nowMins    = getAddisAbabaMinutes(now);
  const shiftStart = beforeLunchStart(shift);
  const shiftEnd   = afterLunchEnd(shift);
  const earlyWindow = shiftStart - 60; // allow early arrivals

  // ── No record yet ──────────────────────────────────────────────────────────
  if (!record) {
    if (nowMins >= shiftEnd) return 'closed';
    if (nowMins < earlyWindow) return 'too_early';

    if (shift.lunchEnabled) {
      const lunchEnd = afterLunchStart(shift);
      // Arrived after lunch with no record → after-lunch session
      if (nowMins >= lunchEnd) return 'afterlunch_checkin';
    }
    return 'morning_checkin';
  }

  // ── Record exists ──────────────────────────────────────────────────────────
  const hasCheckOut           = !!record.checkOutTime;        // auto lunch checkout
  const hasAfterLunchCheckIn  = !!record.afterLunchCheckIn;
  const hasAfterLunchCheckOut = !!record.afterLunchCheckOut;

  // Fully complete
  if (hasAfterLunchCheckIn && hasAfterLunchCheckOut) return 'day_complete';

  // No lunch feature — single session, end-of-day checkout only
  if (!shift.lunchEnabled) {
    if (hasCheckOut) return 'day_complete';
    if (nowMins >= shiftEnd) return 'auto_checkout';
    return 'afterlunch_checkout'; // reuse as "end of day" checkout action
  }

  // Lunch enabled
  const lunchStart = beforeLunchEnd(shift);
  const lunchEnd   = afterLunchStart(shift);

  // Auto lunch checkout has happened, waiting for after-lunch check-in
  if (hasCheckOut && !hasAfterLunchCheckIn) {
    if (nowMins < lunchEnd) return 'in_break';   // still within lunch window
    return 'afterlunch_checkin';                  // lunch over, scan to return
  }

  // After-lunch checked in, waiting for evening checkout
  if (hasAfterLunchCheckIn && !hasAfterLunchCheckOut) {
    return 'afterlunch_checkout';
  }

  // Morning checked in, auto checkout hasn't fired yet
  if (!hasCheckOut) {
    // Shift end passed without any lunch action → auto checkout the record now
    if (nowMins >= shiftEnd) return 'auto_checkout';
    // Within lunch window — cron hasn't fired yet, tell them it's break time
    if (nowMins >= lunchStart) return 'in_break';
    // Still working morning — nothing to do at kiosk
    return 'morning_active';
  }

  return 'day_complete';
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/mark  — public kiosk endpoint (handles all session types)
// ─────────────────────────────────────────────────────────────────────────────
const markAttendance = async (req, res) => {
  try {
    const { faceDescriptor, livenessProof } = req.body || {};
    if (!isValidFaceDescriptor(faceDescriptor)) {
      await logFailedFaceScan(req, { reason: 'invalid_descriptor' });
      return res.status(400).json({ success: false, message: 'Invalid face descriptor.' });
    }
    if (!(await consumeLivenessChallenge(livenessProof))) {
      await logFailedFaceScan(req, { reason: 'liveness_failed' });
      return res.status(403).json({
        success: false,
        message: 'Camera liveness verification failed or expired. Please try the live camera check again.',
      });
    }

    const recognition = await recognizeFace(faceDescriptor);
    const { matched, employee, distance, hasCandidates } = recognition;
    if (!hasCandidates) {
      await logFailedFaceScan(req, { reason: 'no_registered_faces' });
      return res.status(404).json({ success: false, message: 'No registered faces found.' });
    }
    if (!matched) {
      await logFailedFaceScan(req, { reason: 'unknown_face', distance });
      return res.status(404).json({
        success: false,
        message: 'Face not recognised. Contact HR to register your face.',
      });
    }

    const today = getAddisAbabaDateString();
    const now   = new Date();
    const shift = await getShift();

    const { record, duplicate } = await claimScanWindow(employee, today, now);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        alreadyScanned: true,
        message: 'This employee was scanned recently. Please wait 30 seconds before scanning again.',
      });
    }
    const action = resolveSessionAction(record, now, shift);

    const empInfo = {
      fullName:   employee.fullName,
      employeeId: employee.employeeId,
      department: employee.department,
      position:   employee.position || '',
      photo:      employee.avatar || '',
    };

    // ── too_early ─────────────────────────────────────────────────────────────
    if (action === 'too_early') {
      const startMins = beforeLunchStart(shift) - 60;
      const opensAt = createAddisAbabaDateTime(today, Math.floor(startMins / 60), startMins % 60);
      return res.status(400).json({
        success: false,
        tooEarly: true,
        message: `Check-in is not open yet. Come back at ${fmtTime(opensAt)}.`,
        data: { employee: empInfo },
      });
    }

    if (action === 'closed') {
      return res.status(400).json({
        success: false,
        kioskClosed: true,
        message: 'Check-in is closed for today. Please return during scheduled work hours.',
      });
    }

    // ── morning_active (scanned during working hours — already checked in) ────
    if (action === 'morning_active') {
      return res.status(200).json({
        success: false,
        morningActive: true,
        message: `${employee.fullName}, you're already checked in. Enjoy your morning!`,
        data: {
          employee:    empInfo,
          checkInTime: record.checkInTime,
          status:      record.status,
          session:     'morning_active',
        },
      });
    }

    // ── in_break (auto lunch checkout fired, lunch window still open) ─────────
    if (action === 'in_break') {
      const lunchEndMins = afterLunchStart(shift);
      const lunchEndTime = createAddisAbabaDateTime(today, Math.floor(lunchEndMins / 60), lunchEndMins % 60);
      return res.status(200).json({
        success: false,
        inBreak: true,
        message: `Enjoy your lunch, ${employee.fullName}! After-lunch check-in opens at ${fmtTime(lunchEndTime)}.`,
        data: {
          employee:    empInfo,
          checkInTime:  record.checkInTime,
          checkOutTime: record.checkOutTime,
          session:     'break',
        },
      });
    }

    // ── day_complete ──────────────────────────────────────────────────────────
    if (action === 'day_complete') {
      return res.status(409).json({
        success: false,
        dayComplete: true,
        message: `${employee.fullName}, your attendance for today is fully recorded. See you tomorrow!`,
        data: {
          employee: empInfo,
          checkInTime:        record.checkInTime,
          checkOutTime:       record.checkOutTime,
          afterLunchCheckIn:  record.afterLunchCheckIn,
          afterLunchCheckOut: record.afterLunchCheckOut,
          status: record.status,
          session: 'complete',
        },
      });
    }

    // ── morning_checkin ───────────────────────────────────────────────────────
    if (action === 'morning_checkin') {
      const { status, lateMinutes } = calcStatus(now, shift);

      const newRecord = await Attendance.create({
        userId:          employee._id,
        employee:        employee.employeeRef || null,
        employeeId:      employee.employeeId,
        fullName:        employee.fullName,
        department:      employee.department,
        position:        employee.position || '',
        date:            today,
        checkInTime:     now,
        status,
        lateMinutes,
        matchConfidence: parseFloat(distance.toFixed(4)),
        confidence:      parseFloat(distance.toFixed(4)),
        livenessScore:   1,
        timestamp:      now,
        lastScanAt:     now,
        ipAddress:       req.ip || '',
        deviceInfo:      String(req.get('user-agent') || '').slice(0, 300),
        recognitionMethod: 'Face Recognition',
      });
      await notifyAttendanceEvent(employee, shift, 'check-in', { time: now, status, lateMinutes });

      return res.status(201).json({
        success: true,
        action: 'morning_checkin',
        message: `Welcome, ${employee.fullName}! Morning check-in recorded.`,
        data: {
          employee:   empInfo,
          checkInTime: newRecord.checkInTime,
          status:      newRecord.status,
          lateMinutes: newRecord.lateMinutes,
          lateLabel:   lateLabel(newRecord.lateMinutes),
          date:        newRecord.date,
          session:     'morning',
        },
      });
    }

    // ── afterlunch_checkin (no existing record — arrived only for afternoon) ──
    if (action === 'afterlunch_checkin' && !record) {
      const newRecord = await Attendance.create({
        userId:            employee._id,
        employee:          employee.employeeRef || null,
        employeeId:        employee.employeeId,
        fullName:          employee.fullName,
        department:        employee.department,
        position:          employee.position || '',
        date:              today,
        checkInTime:       now,
        afterLunchCheckIn: now,
        status:            'Late',
        lateMinutes:       0,
        matchConfidence:   parseFloat(distance.toFixed(4)),
        confidence:        parseFloat(distance.toFixed(4)),
        livenessScore:     1,
        timestamp:         now,
        lastScanAt:        now,
        ipAddress:         req.ip || '',
        deviceInfo:        String(req.get('user-agent') || '').slice(0, 300),
        recognitionMethod: 'Face Recognition',
      });

      return res.status(201).json({
        success: true,
        action:  'afterlunch_checkin',
        message: `Welcome back, ${employee.fullName}! After-lunch check-in recorded.`,
        data: {
          employee:          empInfo,
          afterLunchCheckIn: newRecord.afterLunchCheckIn,
          status:            newRecord.status,
          date:              newRecord.date,
          session:           'afterlunch',
        },
      });
    }

    // ── morning_checkout — REMOVED: handled automatically by the lunch cron job ─

    // ── afterlunch_checkin (record exists — returning from lunch) ─────────────
    if (action === 'afterlunch_checkin') {
      record.afterLunchCheckIn = now;
      await record.save();
      await notifyAttendanceEvent(employee, shift, 'check-in', { time: now, status: record.status, lateMinutes: 0 });

      return res.status(200).json({
        success: true,
        action:  'afterlunch_checkin',
        message: `Welcome back, ${employee.fullName}! After-lunch check-in recorded.`,
        data: {
          employee:          empInfo,
          checkInTime:       record.checkInTime,
          checkOutTime:      record.checkOutTime,
          afterLunchCheckIn: record.afterLunchCheckIn,
          status:            record.status,
          date:              record.date,
          session:           'afterlunch',
        },
      });
    }

    // ── afterlunch_checkout (end of day — or single-session checkout) ─────────
    if (action === 'afterlunch_checkout') {
      if (shift.lunchEnabled) {
        record.afterLunchCheckOut = now;
      } else {
        record.checkOutTime = now;
      }
      await record.save();
      await notifyAttendanceEvent(employee, shift, 'check-out', { time: now, status: record.status });

      return res.status(200).json({
        success: true,
        action:  'afterlunch_checkout',
        message: `Goodbye, ${employee.fullName}! Have a great evening.`,
        data: {
          employee:           empInfo,
          checkInTime:        record.checkInTime,
          checkOutTime:       record.checkOutTime,
          afterLunchCheckIn:  record.afterLunchCheckIn,
          afterLunchCheckOut: record.afterLunchCheckOut,
          status:             record.status,
          date:               record.date,
          session:            'afterlunch_checkout',
        },
      });
    }

    // ── auto_checkout (shift ended, no lunch session recorded) ──────────────
    if (action === 'auto_checkout') {
      // Set checkout to official shift-end time
      const endMins = afterLunchEnd(shift);
      const shiftEndTime = createAddisAbabaDateTime(today, Math.floor(endMins / 60), endMins % 60);

      record.checkOutTime = shiftEndTime;
      await record.save();
      await notifyAttendanceEvent(employee, shift, 'check-out', { time: shiftEndTime, status: record.status, auto: true });

      return res.status(200).json({
        success: true,
        action: 'auto_checkout',
        autoCheckout: true,
        message: `${employee.fullName}, your shift ended. Auto check-out applied at ${fmtTime(shiftEndTime)}.`,
        data: {
          employee:    empInfo,
          checkInTime:  record.checkInTime,
          checkOutTime: record.checkOutTime,
          status:       record.status,
          date:         record.date,
          session:      'auto_checkout',
        },
      });
    }

    // Fallback
    return res.status(400).json({ success: false, message: 'Unable to determine session action.' });

  } catch (err) {
    console.error('MarkAttendance error:', err);
    await logFailedFaceScan(req, { reason: 'server_error' });
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        alreadyScanned: true,
        message: 'Attendance was recorded by another scan. Please wait before trying again.',
      });
    }
    return res.status(500).json({ success: false, message: 'Server error during check-in.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/checkout  — explicit employee-initiated checkout
//
// Separate from markAttendance so checkout is NEVER blocked by session-window
// logic.  An employee who already checked in can always check out.
//
// Rules:
//   1. Face must be recognised.
//   2. A today-record must exist (they must have checked in first).
//   3. If lunch is enabled and afterLunchCheckIn is set but afterLunchCheckOut
//      is null → write afterLunchCheckOut.
//   4. Otherwise write checkOutTime (covers both lunch-disabled and the rare
//      case of a manual checkout before the cron fires).
//   5. If the record already has both checkout fields filled → day_complete.
//   6. If no record at all today → tell them to check in first.
// ─────────────────────────────────────────────────────────────────────────────
const checkOutAttendance = async (req, res) => {
  try {
    const { faceDescriptor, livenessProof } = req.body || {};
    if (!isValidFaceDescriptor(faceDescriptor)) {
      await logFailedFaceScan(req, { reason: 'invalid_descriptor' });
      return res.status(400).json({ success: false, message: 'Invalid face descriptor.' });
    }
    if (!(await consumeLivenessChallenge(livenessProof))) {
      await logFailedFaceScan(req, { reason: 'liveness_failed' });
      return res.status(403).json({
        success: false,
        message: 'Camera liveness verification failed or expired. Please try the live camera check again.',
      });
    }

    /* ── Face recognition ── */
    const recognition = await recognizeFace(faceDescriptor);
    const { matched, employee, distance, hasCandidates } = recognition;
    if (!hasCandidates) {
      await logFailedFaceScan(req, { reason: 'no_registered_faces' });
      return res.status(404).json({ success: false, message: 'No registered faces found.' });
    }
    if (!matched) {
      await logFailedFaceScan(req, { reason: 'unknown_face', distance });
      return res.status(404).json({
        success: false,
        message: 'Face not recognised. Contact HR to register your face.',
      });
    }

    const today = getAddisAbabaDateString();
    const now   = new Date();
    const shift = await getShift();

    const { record, duplicate } = await claimScanWindow(employee, today, now);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        alreadyScanned: true,
        message: 'This employee was scanned recently. Please wait 30 seconds before scanning again.',
      });
    }
    const empInfo = {
      fullName:   employee.fullName,
      employeeId: employee.employeeId,
      department: employee.department,
      position:   employee.position || '',
      photo:      employee.avatar || '',
    };

    /* ── Must have checked in today ── */
    if (!record) {
      return res.status(400).json({
        success: false,
        noRecord: true,
        message: `${employee.fullName}, you haven't checked in yet today. Please check in first.`,
        data: { employee: empInfo },
      });
    }

    /* ── Determine which checkout field to fill ── */
    const lunchEnabled       = shift.lunchEnabled;
    const hasAfterLunchIn    = !!record.afterLunchCheckIn;
    const hasAfterLunchOut   = !!record.afterLunchCheckOut;
    const hasCheckOut        = !!record.checkOutTime;

    /*
     * Day already fully recorded — both the morning checkout (auto) and
     * the after-lunch checkout have happened.
     */
    if (lunchEnabled && hasAfterLunchIn && hasAfterLunchOut) {
      return res.status(409).json({
        success: false,
        dayComplete: true,
        message: `${employee.fullName}, your attendance for today is fully recorded. See you tomorrow!`,
        data: {
          employee:           empInfo,
          checkInTime:        record.checkInTime,
          checkOutTime:       record.checkOutTime,
          afterLunchCheckIn:  record.afterLunchCheckIn,
          afterLunchCheckOut: record.afterLunchCheckOut,
          status:             record.status,
          session:            'complete',
        },
      });
    }

    /*
     * Without lunch: only one checkout needed (checkOutTime).
     * If it's already set, the day is complete.
     */
    if (!lunchEnabled && hasCheckOut) {
      return res.status(409).json({
        success: false,
        dayComplete: true,
        message: `${employee.fullName}, you've already checked out for today.`,
        data: {
          employee:     empInfo,
          checkInTime:  record.checkInTime,
          checkOutTime: record.checkOutTime,
          status:       record.status,
          session:      'complete',
        },
      });
    }

    /*
     * Write the checkout timestamp to the correct field:
     *   • Lunch enabled + returned from lunch → afterLunchCheckOut
     *   • Lunch enabled + not yet returned    → checkOutTime  (pre-lunch departure)
     *   • Lunch disabled                      → checkOutTime
     */
    let checkoutField;
    if (lunchEnabled && hasAfterLunchIn && !hasAfterLunchOut) {
      record.afterLunchCheckOut = now;
      checkoutField = 'afterLunchCheckOut';
    } else {
      record.checkOutTime = now;
      checkoutField = 'checkOutTime';
    }

    await record.save();
    await notifyAttendanceEvent(employee, shift, 'check-out', { time: now, status: record.status });

    /* Calculate working hours */
    const checkinMs   = new Date(record.checkInTime).getTime();
    const checkoutMs  = now.getTime();
    const workedMins  = Math.max(0, Math.round((checkoutMs - checkinMs) / 60000));
    const workedHrs   = Math.floor(workedMins / 60);
    const workedMin   = workedMins % 60;
    const workedLabel = `${workedHrs}h ${workedMin > 0 ? workedMin + 'm' : ''}`.trim();

    /* Early departure detection against shift end */
    const shiftEndMins  = afterLunchEnd(shift);
    const checkoutMins  = getAddisAbabaMinutes(now);
    const earlyMins     = Math.max(0, shiftEndMins - checkoutMins);
    const earlyLabel    = earlyMins > 0
      ? (earlyMins >= 60
          ? `Left ${Math.floor(earlyMins / 60)}h ${earlyMins % 60 > 0 ? earlyMins % 60 + 'm' : ''} early`.trim()
          : `Left ${earlyMins}m early`)
      : 'On time';

    return res.status(200).json({
      success: true,
      action:  checkoutField === 'afterLunchCheckOut' ? 'afterlunch_checkout' : 'checkout',
      message: `Goodbye, ${employee.fullName}! Safe travels. (Worked: ${workedLabel})`,
      data: {
        employee:           empInfo,
        checkInTime:        record.checkInTime,
        checkOutTime:       record.checkOutTime,
        afterLunchCheckIn:  record.afterLunchCheckIn,
        afterLunchCheckOut: record.afterLunchCheckOut,
        status:             record.status,
        date:               record.date,
        workedLabel,
        earlyLabel,
        session: checkoutField === 'afterLunchCheckOut' ? 'afterlunch_checkout' : 'checkout',
      },
    });

  } catch (err) {
    console.error('CheckOut error:', err);
    await logFailedFaceScan(req, { reason: 'server_error' });
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        alreadyScanned: true,
        message: 'Attendance was recorded by another scan. Please wait before trying again.',
      });
    }
    return res.status(500).json({ success: false, message: 'Server error during check-out.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/kiosk-status  — public, returns shift info for the kiosk UI
// ─────────────────────────────────────────────────────────────────────────────
const getKioskStatus = async (req, res) => {
  try {
    const shift = await getShift();
    const now   = new Date();
    const nowMins = getAddisAbabaMinutes(now);

    const shiftStartMins = beforeLunchStart(shift);
    const shiftEndMins   = afterLunchEnd(shift);
    const lunchStartMins = shift.lunchEnabled
      ? beforeLunchEnd(shift)
      : null;
    const lunchEndMins = lunchStartMins !== null
      ? afterLunchStart(shift)
      : null;

    // Determine global kiosk mode
    let kioskMode = 'morning'; // default
    if (shift.lunchEnabled) {
      if (lunchStartMins !== null && nowMins >= lunchStartMins && nowMins < lunchEndMins) {
        kioskMode = 'break';
      } else if (lunchEndMins !== null && nowMins >= lunchEndMins) {
        kioskMode = 'afterlunch';
      }
    }
    if (nowMins >= shiftEndMins) kioskMode = 'closed';

    return res.json({
      success: true,
      data: {
        shift: {
          startHour:        Math.floor(shiftStartMins / 60),
          startMinute:      shiftStartMins % 60,
          gracePeriod:      shift.gracePeriod,
          endHour:          Math.floor(shiftEndMins / 60),
          endMinute:        shiftEndMins % 60,
          lunchEnabled:     shift.lunchEnabled,
          lunchStartHour:   lunchStartMins === null ? null : Math.floor(lunchStartMins / 60),
          lunchStartMinute: lunchStartMins === null ? null : lunchStartMins % 60,
          lunchDuration:    lunchStartMins === null ? null : lunchEndMins - lunchStartMins,
        },
        kioskMode,  // 'morning' | 'break' | 'afterlunch' | 'closed'
        serverTime: now.toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance  — admin: full logs
// Joins live department from User so stale/empty values are corrected.
// ─────────────────────────────────────────────────────────────────────────────
const getCompanyAttendance = async (req, res) => {
  try {
    const {
      date, startDate, endDate,
      department, status, employeeId, search,
      page = 1, limit = 50,
    } = req.query;

    const q = {};
    if (date) {
      q.date = date;
    } else if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = startDate;
      if (endDate)   q.date.$lte = endDate;
    }
    /* Department is matched AFTER $lookup so we filter on the live User value. */
    if (status)     q.status     = status;
    if (employeeId) q.employeeId = { $regex: employeeId, $options: 'i' };
    if (search)     q.$or = [
      { fullName:   { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
    ];

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const lim   = parseInt(limit);

    /*
     * $lookup User by userId (ObjectId-safe) and overwrite department with
     * the registered value (IT, HR, Finance, …). Never render "General".
     */
    const pipeline = [
      { $match: q },
      { $sort: { date: -1, checkInTime: -1 } },
      {
        $addFields: {
          _lookupId: {
            $convert: {
              input: '$userId',
              to: 'objectId',
              onError: '$userId',
              onNull: '$userId',
            },
          },
        },
      },
      {
        $lookup: {
          from:         'users',
          localField:   '_lookupId',
          foreignField: '_id',
          as:           '_user',
        },
      },
      { $addFields: { department: DEPARTMENT_FROM_USER } },
      { $project: { _user: 0, _lookupId: 0 } },
    ];

    if (department) {
      pipeline.push({
        $match: { department: { $regex: department, $options: 'i' } },
      });
    }

    // Total count (without pagination stages)
    const countPipeline = [...pipeline, { $count: 'total' }];

    const [rows, countResult] = await Promise.all([
      Attendance.aggregate([...pipeline, { $skip: skip }, { $limit: lim }]),
      Attendance.aggregate(countPipeline),
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.json({
      success: true,
      data: {
        records: rows,
        pagination: {
          total,
          page:       +page,
          limit:      lim,
          totalPages: Math.ceil(total / lim),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/attendance/my  — employee personal
const getMyAttendance = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 30 } = req.query;
    const q = { userId: req.user._id };
    if (startDate || endDate) {
      q.date = {};
      if (startDate) q.date.$gte = startDate;
      if (endDate)   q.date.$lte = endDate;
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(q).sort({ date: -1 }).skip(skip).limit(parseInt(limit)),
      Attendance.countDocuments(q),
    ]);
    return res.json({
      success: true,
      data: { records, pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) } },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/attendance/dashboard  — admin stats
const getDashboard = async (req, res) => {
  try {
    const today = getAddisAbabaDateString();
    const now   = new Date();
    const monthStart = `${getAddisAbabaDateString(now).slice(0, 7)}-01`;

    const [totalEmployees, [dashboard = {}]] = await Promise.all([
      Employee.countDocuments({ status: 'Active' }),
      Attendance.aggregate([
        { $match: { date: { $gte: monthStart, $lte: today } } },
        {
          $facet: {
            todaySummary: [
              { $match: { date: today } },
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            todayRecords: [
              { $match: { date: today } },
              { $sort: { checkInTime: -1 } },
              { $limit: 10 },
              {
                $project: {
                  fullName: 1,
                  employeeId: 1,
                  department: 1,
                  checkInTime: 1,
                  status: 1,
                },
              },
            ],
            monthlyTrend: [
              {
                $group: {
                  _id: '$date',
                  present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                  late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
                  total: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
              { $limit: 31 },
            ],
            deptStats: [
              { $match: { date: today } },
              { $group: { _id: '$department', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 8 },
            ],
          },
        },
      ]),
    ]);

    const summaryByStatus = Object.fromEntries(
      (dashboard.todaySummary || []).map(({ _id, count }) => [_id, count]),
    );
    const presentToday = summaryByStatus.Present || 0;
    const lateToday = summaryByStatus.Late || 0;

    const checkedIn   = presentToday + lateToday;
    const absentToday = Math.max(0, totalEmployees - checkedIn);

    return res.json({
      success: true,
      data: {
        summary: { totalEmployees, presentToday, lateToday, absentToday, checkedIn },
        recentCheckIns: dashboard.todayRecords || [],
        monthlyTrend: dashboard.monthlyTrend || [],
        deptStats: dashboard.deptStats || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/attendance/my/stats
const getMyStats = async (req, res) => {
  try {
    const now        = new Date();
    const monthStart = `${getAddisAbabaDateString(now).slice(0, 7)}-01`;
    const yearStart  = `${getAddisAbabaDateString(now).slice(0, 4)}-01-01`;

    const [monthStats, yearStats, recent] = await Promise.all([
      Attendance.aggregate([
        { $match: { userId: req.user._id, date: { $gte: monthStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { userId: req.user._id, date: { $gte: yearStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Attendance.find({ userId: req.user._id }).sort({ date: -1 }).limit(14),
    ]);

    const toMap = (arr) => arr.reduce((m, x) => { m[x._id] = x.count; return m; }, {});
    const ms = toMap(monthStats);
    const ys = toMap(yearStats);

    const totalYear   = Object.values(ys).reduce((a, b) => a + b, 0);
    const presentYear = (ys.Present || 0) + (ys.Late || 0);
    const rate = totalYear > 0 ? Math.round((presentYear / totalYear) * 100) : 0;

    return res.json({
      success: true,
      data: {
        month: { present: ms.Present || 0, late: ms.Late || 0, absent: ms.Absent || 0 },
        year:  { present: ys.Present || 0, late: ys.Late  || 0, absent: ys.Absent  || 0, rate },
        recentActivity: recent,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/analytics  — admin: per-employee period summaries
//
// Query params:
//   startDate  YYYY-MM-DD  (required)
//   endDate    YYYY-MM-DD  (required)
//   department string      (optional filter)
//   search     string      (optional, matches fullName or employeeId)
//
// Response per employee:
//   employeeId, fullName, department, position
//   presentDays, lateDays, absentDays, totalWorkingDays
//   attendancePct      (present+late / totalWorkingDays × 100)
//   totalLateMinutes   (sum of lateMinutes across period)
//   lateOccurrences    (number of Late records)
//   healthFlag         'normal' | 'warning' | 'termination_risk'
//
// Warning rules:
//   termination_risk  → absentDays > 5  OR  totalLateMinutes > 300 (5 h)
//   warning           → lateOccurrences > 3  OR  attendancePct < 85
//   normal            → everything else
// ─────────────────────────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, department, search } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required (YYYY-MM-DD).',
      });
    }

    /* ── Working days in the requested range (Mon–Fri only) ── */
    const countWorkingDays = (start, end) => {
      let count = 0;
      const cur = new Date(start + 'T00:00:00');
      const fin = new Date(end   + 'T00:00:00');
      while (cur <= fin) {
        const dow = cur.getDay(); // 0 Sun … 6 Sat
        if (dow !== 0 && dow !== 6) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    };
    const totalWorkingDays = countWorkingDays(startDate, endDate);

    /* ── Pull all active employees matching optional filters ── */
    const userQ = { role: 'employee', isActive: true };
    if (department) userQ.department = { $regex: department, $options: 'i' };
    if (search) {
      userQ.$or = [
        { fullName:   { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }
    const employees = await User.find(userQ)
      .select('fullName employeeId department position')
      .lean();

    if (!employees.length) {
      return res.json({
        success: true,
        data: {
          employees: [],
          totals: {
            presentDays: 0, lateDays: 0, absentDays: 0,
            totalLateMinutes: 0, warningCount: 0, riskCount: 0,
            lateTotalLabel: '0m',
          },
          totalWorkingDays,
          periodStart: startDate,
          periodEnd:   endDate,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    /* ── Aggregate attendance records for the period ── */
    const userIds = employees.map(e => e._id);
    const records = await Attendance.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          date:   { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id:               '$userId',
          presentDays:       { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          lateDays:          { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
          totalLateMinutes:  { $sum: { $ifNull: ['$lateMinutes', 0] } },
          recordedDays:      { $sum: 1 },
        },
      },
    ]);

    /* Index aggregation by userId string */
    const recMap = {};
    records.forEach(r => { recMap[r._id.toString()] = r; });

    /* ── Build per-employee summary ── */
    const result = employees.map(emp => {
      const r = recMap[emp._id.toString()] ?? {
        presentDays: 0, lateDays: 0, totalLateMinutes: 0, recordedDays: 0,
      };

      const presentDays      = r.presentDays;
      const lateDays         = r.lateDays;
      const lateOccurrences  = lateDays;           // each Late record = 1 late occurrence
      const totalLateMinutes = r.totalLateMinutes;
      const attendedDays     = r.recordedDays;     // present + late (days with any check-in)
      const absentDays       = Math.max(0, totalWorkingDays - attendedDays);
      const attendancePct    = totalWorkingDays > 0
        ? Math.round((attendedDays / totalWorkingDays) * 100)
        : 0;

      /* ── Escalation logic ── */
      let healthFlag = 'normal';
      if (absentDays > 5 || totalLateMinutes > 300) {
        healthFlag = 'termination_risk';
      } else if (lateOccurrences > 3 || attendancePct < 85) {
        healthFlag = 'warning';
      }

      /* Human-readable late time, e.g. "1h 45m" */
      const latHrs = Math.floor(totalLateMinutes / 60);
      const latMin = totalLateMinutes % 60;
      const lateTotalLabel = totalLateMinutes === 0
        ? '—'
        : latHrs > 0
          ? `${latHrs}h ${latMin > 0 ? latMin + 'm' : ''}`.trim()
          : `${latMin}m`;

      return {
        employeeId:        emp.employeeId,
        fullName:          emp.fullName,
        department:        resolveDepartment(emp.department),
        position:          emp.position,
        presentDays,
        lateDays,
        absentDays,
        totalWorkingDays,
        attendancePct,
        lateOccurrences,
        totalLateMinutes,
        lateTotalLabel,
        healthFlag,        // 'normal' | 'warning' | 'termination_risk'
      };
    });

    /* Sort: termination_risk first → warning → normal */
    const order = { termination_risk: 0, warning: 1, normal: 2 };
    result.sort((a, b) => (order[a.healthFlag] ?? 3) - (order[b.healthFlag] ?? 3));

    const totals = result.reduce((acc, e) => {
      acc.presentDays      += e.presentDays;
      acc.lateDays         += e.lateDays;
      acc.absentDays       += e.absentDays;
      acc.totalLateMinutes += e.totalLateMinutes;
      if (e.healthFlag === 'warning') acc.warningCount += 1;
      if (e.healthFlag === 'termination_risk') acc.riskCount += 1;
      return acc;
    }, {
      presentDays: 0, lateDays: 0, absentDays: 0,
      totalLateMinutes: 0, warningCount: 0, riskCount: 0,
    });

    const tHrs = Math.floor(totals.totalLateMinutes / 60);
    const tMin = totals.totalLateMinutes % 60;
    totals.lateTotalLabel = totals.totalLateMinutes === 0
      ? '0m'
      : tHrs > 0
        ? `${tHrs}h ${tMin > 0 ? tMin + 'm' : ''}`.trim()
        : `${tMin}m`;

    return res.json({
      success: true,
      data: {
        employees:       result,
        totals,
        totalWorkingDays,
        periodStart:     startDate,
        periodEnd:       endDate,
        generatedAt:     new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  markAttendance,
  checkOutAttendance,
  getKioskStatus,
  getCompanyAttendance,
  getMyAttendance,
  getDashboard,
  getMyStats,
  getAnalytics,
  notifyAttendanceEvent,
  resolveSessionAction,
};
