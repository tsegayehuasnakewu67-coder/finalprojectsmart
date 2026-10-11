const Attendance = require('../models/Attendance');
const { getAddisAbabaDateString } = require('../utils/ethiopianTime');

const isDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const reportQuery = (req, res) => {
  const { from, to, department, status, employeeId } = req.query;
  if (!isDateKey(from) || !isDateKey(to)) {
    res.status(400).json({ success: false, message: 'from and to must be valid Gregorian YYYY-MM-DD dates.' });
    return null;
  }
  if (from > to) {
    res.status(400).json({ success: false, message: 'from must be on or before to.' });
    return null;
  }
  const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (rangeDays > 366) {
    res.status(400).json({ success: false, message: 'Attendance reports are limited to a 367-day inclusive date range.' });
    return null;
  }

  const query = { date: { $gte: from, $lte: to } };
  if (status) query.status = status;
  if (department) query.department = new RegExp(String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (employeeId) query.employeeId = new RegExp(String(employeeId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return query;
};

const getTodayAttendance = async (req, res, next) => {
  try {
    const date = getAddisAbabaDateString();
    const records = await Attendance.find({ date })
      .sort({ checkInTime: 1, employeeId: 1 })
      .populate('employee', 'employeeId firstName lastName department position')
      .lean();
    return res.json({ success: true, data: { date, records, total: records.length } });
  } catch (error) {
    return next(error);
  }
};

const getAttendanceReport = async (req, res, next) => {
  const query = reportQuery(req, res);
  if (!query) return;
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 50;
  try {
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1, checkInTime: -1, employeeId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('employee', 'employeeId firstName lastName department position')
        .lean(),
      Attendance.countDocuments(query),
    ]);
    return res.json({
      success: true,
      data: {
        records,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    return next(error);
  }
};

const csvCell = (value) => {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const exportAttendanceReport = async (req, res, next) => {
  const query = reportQuery(req, res);
  if (!query) return;
  const { from, to } = req.query;
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${from}-to-${to}.csv"`);
    res.write('\uFEFFemployeeId,fullName,department,date,status,checkInTime,checkOutTime,confidence,method,ipAddress,deviceInfo\r\n');
    const cursor = Attendance.find(query)
      .select('employeeId fullName department date status checkInTime checkOutTime confidence recognitionMethod ipAddress deviceInfo')
      .sort({ date: -1, checkInTime: -1, employeeId: 1 })
      .lean()
      .cursor();
    for await (const record of cursor) {
      if (res.destroyed) return;
      const values = [
        record.employeeId,
        record.fullName,
        record.department,
        record.date,
        record.status,
        record.checkInTime,
        record.checkOutTime,
        record.confidence,
        record.recognitionMethod,
        record.ipAddress,
        record.deviceInfo,
      ];
      if (!res.write(`${values.map(csvCell).join(',')}\r\n`)) {
        await new Promise((resolve) => {
          const resume = () => {
            res.off('drain', resume);
            res.off('close', resume);
            resolve();
          };
          res.once('drain', resume);
          res.once('close', resume);
        });
      }
      if (res.destroyed) return;
    }
    return res.end();
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    return next(error);
  }
};

module.exports = { getTodayAttendance, getAttendanceReport, exportAttendanceReport };
