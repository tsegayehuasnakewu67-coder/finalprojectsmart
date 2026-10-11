const User       = require('../models/User');
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const { syncEmployeeForUser } = require('../utils/employeeSync');
const { findDuplicateFace } = require('../utils/faceRegistration');
const { invalidateFaceCandidates } = require('../services/faceRecognitionService');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const { search, department, role, isActive, page = 1, limit = 50 } = req.query;
    const q = {};
    if (search) {
      q.$or = [
        { fullName:   { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } },
      ];
    }
    if (department) q.department = { $regex: department, $options: 'i' };
    if (role)       q.role = role;
    if (isActive !== undefined) q.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(q).select('-faceDescriptor').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(q),
    ]);
    return res.json({
      success: true,
      data: {
        users,
        employees: users,
        pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-faceDescriptor');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.role === 'employee' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const employeeQuery = { $or: [{ user: user._id }, { employeeId: user.employeeId }] };
    const employee = await Employee.findOne(employeeQuery)
      .select('phone gender dateOfBirth address photo status faceEncoding');
    const userData = user.toJSON();
    if (employee) {
      Object.assign(userData, {
        employeeProfileId: employee._id,
        phone: employee.phone,
        gender: employee.gender,
        dateOfBirth: employee.dateOfBirth,
        address: employee.address,
        photo: employee.photo,
        status: employee.status,
        faceRegistered: employee.faceEncoding.length === 128,
      });
    } else {
      userData.faceRegistered = false;
    }
    return res.json({ success: true, data: { user: userData } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const {
      fullName, employeeId, email, department, position, role, isActive, password,
      phone, gender, dateOfBirth, address, photo,
    } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const previousRole = user.role;
    const previousActiveState = user.isActive;
    if (password !== undefined) {
      return res.status(400).json({ success: false, message: 'Use the authorized password-reset workflow to change account passwords.' });
    }

    if (fullName !== undefined) {
      if (!String(fullName).trim() || String(fullName).trim().length > 201) {
        return res.status(400).json({ success: false, message: 'Full name is required and must be 201 characters or fewer.' });
      }
      user.fullName = String(fullName).trim();
      user.name = user.fullName;
    }
    if (employeeId !== undefined) {
      const normalizedEmployeeId = String(employeeId).trim().toUpperCase();
      if (!normalizedEmployeeId || normalizedEmployeeId.length > 64) {
        return res.status(400).json({ success: false, message: 'Employee ID is required and must be 64 characters or fewer.' });
      }
      const [duplicateUser, duplicateEmployee] = await Promise.all([
        User.exists({ employeeId: normalizedEmployeeId, _id: { $ne: user._id } }),
        Employee.findOne({ employeeId: normalizedEmployeeId }).select('user'),
      ]);
      if (duplicateUser || (duplicateEmployee && normalizedEmployeeId !== user.employeeId
        && String(duplicateEmployee.user || '') !== String(user._id))) {
        return res.status(409).json({ success: false, message: 'Employee ID is already in use.' });
      }
      user.employeeId = normalizedEmployeeId;
    }
    if (email !== undefined) user.email = String(email).toLowerCase().trim();
    if (department !== undefined) {
      if (!String(department).trim() || String(department).trim().length > 100) {
        return res.status(400).json({ success: false, message: 'Department is required and must be 100 characters or fewer.' });
      }
      user.department = String(department).trim();
    }
    if (position !== undefined) {
      if (!String(position).trim() || String(position).trim().length > 100) {
        return res.status(400).json({ success: false, message: 'Position is required and must be 100 characters or fewer.' });
      }
      user.position = String(position).trim();
    }
    if (role !== undefined) {
      if (!['admin', 'hr', 'employee'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid user role.' });
      }
      user.role = role;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
      user.isActive = isActive;
    }
    if (photo !== undefined) {
      if (String(photo).trim().length > 500) return res.status(400).json({ success: false, message: 'Profile photo URL must be 500 characters or fewer.' });
      user.avatar = String(photo).trim();
    }

    const employeeProfile = {};
    if (phone !== undefined) {
      if (String(phone).trim().length > 32) return res.status(400).json({ success: false, message: 'Phone number must be 32 characters or fewer.' });
      employeeProfile.phone = String(phone).trim();
    }
    if (gender !== undefined) {
      if (String(gender).trim().length > 40) return res.status(400).json({ success: false, message: 'Gender must be 40 characters or fewer.' });
      employeeProfile.gender = String(gender).trim();
    }
    if (dateOfBirth !== undefined) {
      if (dateOfBirth) {
        const parsedDate = new Date(dateOfBirth);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Date of birth must be a valid date.' });
        }
        employeeProfile.dateOfBirth = parsedDate;
      } else {
        employeeProfile.dateOfBirth = null;
      }
    }
    if (address !== undefined) {
      if (String(address).trim().length > 300) return res.status(400).json({ success: false, message: 'Address must be 300 characters or fewer.' });
      employeeProfile.address = String(address).trim();
    }
    if (department !== undefined) employeeProfile.department = String(department).trim();
    if (position !== undefined) employeeProfile.position = String(position).trim();
    if (fullName !== undefined) employeeProfile.firstName = String(fullName).trim().split(/\s+/)[0] || 'Employee';
    if (fullName !== undefined) employeeProfile.lastName = String(fullName).trim().split(/\s+/).slice(1).join(' ') || 'Unknown';
    if (req.body.status !== undefined) {
      if (!['Active', 'Inactive', 'On Leave'].includes(req.body.status)) {
        return res.status(400).json({ success: false, message: 'Invalid employment status.' });
      }
      employeeProfile.status = req.body.status;
      if (req.body.status !== 'On Leave') user.isActive = req.body.status === 'Active';
    }

    if (user.role !== previousRole || user.isActive !== previousActiveState) {
      user.authVersion = (user.authVersion || 0) + 1;
    }
    await user.save();
    const employee = await syncEmployeeForUser(user, { preserveFace: true });
    if (employee) {
      await Employee.findByIdAndUpdate(employee._id, { $set: employeeProfile }, { runValidators: true });
    }
    if (req.body.isActive !== undefined || req.body.employeeId !== undefined || req.body.status !== undefined) {
      invalidateFaceCandidates();
    }
    return res.json({ success: true, message: 'User updated.', data: { user: user.toJSON() } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email or employee ID is already in use.' });
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    await Attendance.deleteMany({ userId: user._id });
    await Employee.deleteOne({ user: user._id });
    await User.findByIdAndDelete(req.params.id);
    invalidateFaceCandidates();
    return res.json({ success: true, message: `"${user.fullName}" deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/face
const updateFace = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128
      || !faceDescriptor.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2)) {
      return res.status(400).json({ success: false, message: 'Need 128-element array.' });
    }
    const existingUser = await User.findById(req.params.id).select('employeeRef');
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found.' });
    const duplicate = await findDuplicateFace(faceDescriptor, {
      excludeUserId: existingUser._id,
      excludeEmployeeId: existingUser.employeeRef,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `This face is already registered to "${duplicate.fullName}" (ID: ${duplicate.employeeId}).`,
      });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id, { faceDescriptor }, { new: true, runValidators: true }
    ).select('-faceDescriptor');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await Employee.findOneAndUpdate(
      { employeeId: user.employeeId },
      { $set: { faceEncoding: faceDescriptor } },
      { runValidators: true },
    );
    invalidateFaceCandidates();
    return res.json({ success: true, message: 'Face registered.', data: { user } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/departments
const getDepartments = async (req, res) => {
  try {
    const depts = await User.distinct('department');
    return res.json({ success: true, data: { departments: depts.sort() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser, updateFace, getDepartments };
