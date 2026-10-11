const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

const validDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
const validId = (id) => mongoose.isValidObjectId(id);
const pagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

const listAttendance = async (req, res) => {
  try {
    const { date, startDate, endDate, status, department, employeeId, employee } = req.query;
    const query = {};
    if (date) {
      if (!validDate(String(date))) return res.status(400).json({ success: false, message: 'Date must use YYYY-MM-DD.' });
      query.date = date;
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        if (!validDate(String(startDate))) return res.status(400).json({ success: false, message: 'Invalid startDate.' });
        query.date.$gte = startDate;
      }
      if (endDate) {
        if (!validDate(String(endDate))) return res.status(400).json({ success: false, message: 'Invalid endDate.' });
        query.date.$lte = endDate;
      }
    }
    if (status) query.status = status;
    if (department) query.department = new RegExp(String(department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (employeeId) query.employeeId = new RegExp(String(employeeId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (employee && validId(employee)) query.employee = employee;

    const { page, limit, skip } = pagination(req.query);
    const [records, total] = await Promise.all([
      Attendance.find(query).sort({ date: -1, checkInTime: -1 }).skip(skip).limit(limit).populate('employee', 'employeeId firstName lastName department position'),
      Attendance.countDocuments(query),
    ]);
    return res.json({
      success: true,
      data: { records, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve attendance records.' });
  }
};

const getAttendance = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid attendance id.' });
  try {
    const record = await Attendance.findById(req.params.id).populate('employee', 'employeeId firstName lastName department position');
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return res.json({ success: true, data: { record } });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve attendance record.' });
  }
};

const createAttendance = async (req, res) => {
  try {
    const {
      employeeId, employee: employeeRef, date, checkIn, checkOut, status = 'Present',
      recognitionMethod = 'Manual', confidence = null, notes = '',
    } = req.body;
    if (!employeeId || !date || !validDate(String(date))) {
      return res.status(400).json({ success: false, message: 'Employee ID and a valid YYYY-MM-DD date are required.' });
    }
    if (!['Present', 'Late', 'Absent', 'Leave'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid attendance status.' });
    }
    if (!['Face Recognition', 'Manual'].includes(recognitionMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid recognition method.' });
    }
    const employeeQuery = employeeRef && validId(employeeRef) ? { _id: employeeRef } : { employeeId: String(employeeId).trim().toUpperCase() };
    const employeeDoc = await Employee.findOne(employeeQuery);
    if (!employeeDoc) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const duplicate = await Attendance.findOne({ employee: employeeDoc._id, date });
    if (duplicate) return res.status(409).json({ success: false, message: 'Attendance already exists for this employee and date.' });

    const record = await Attendance.create({
      userId: employeeDoc.user || null,
      employee: employeeDoc._id,
      employeeId: employeeDoc.employeeId,
      fullName: employeeDoc.fullName,
      department: employeeDoc.department,
      position: employeeDoc.position,
      date,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      status,
      recognitionMethod,
      confidence,
      matchConfidence: confidence,
      notes,
    });
    return res.status(201).json({ success: true, message: 'Attendance recorded.', data: { record } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Attendance already exists for this employee and date.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Unable to create attendance record.' });
  }
};

const updateAttendance = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid attendance id.' });
  try {
    const allowed = ['date', 'checkIn', 'checkOut', 'status', 'recognitionMethod', 'confidence', 'notes'];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.date && !validDate(String(updates.date))) {
      return res.status(400).json({ success: false, message: 'Date must use YYYY-MM-DD.' });
    }
    if (updates.confidence !== undefined) updates.matchConfidence = updates.confidence;
    const record = await Attendance.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return res.json({ success: true, message: 'Attendance updated.', data: { record } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Attendance already exists for this employee and date.' });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: 'Unable to update attendance record.' });
  }
};

const deleteAttendance = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid attendance id.' });
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    return res.json({ success: true, message: 'Attendance record deleted.' });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to delete attendance record.' });
  }
};

const getEmployeeAttendance = async (req, res) => {
  const employeeId = String(req.params.employeeId).trim().toUpperCase();
  if (req.user.role === 'employee' && req.user.employeeId !== employeeId) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  try {
    const records = await Attendance.find({ employeeId }).sort({ date: -1, checkInTime: -1 });
    return res.json({ success: true, data: { records } });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve employee attendance.' });
  }
};

const getDateAttendance = async (req, res) => {
  const { date } = req.params;
  if (!validDate(date)) return res.status(400).json({ success: false, message: 'Date must use YYYY-MM-DD.' });
  try {
    const records = await Attendance.find({ date }).sort({ employeeId: 1 });
    return res.json({ success: true, data: { records } });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to retrieve attendance for that date.' });
  }
};

module.exports = {
  listAttendance,
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getEmployeeAttendance,
  getDateAttendance,
};
