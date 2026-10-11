const Employee = require('../models/Employee');
const User = require('../models/User');
const { findDuplicateFace } = require('../utils/faceRegistration');
const { invalidateFaceCandidates } = require('../services/faceRecognitionService');
const { isValidFaceDescriptor } = require('../utils/faceMatcher');

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const registerFace = async (req, res) => {
  const {
    employeeId: rawEmployeeId,
    firstName: rawFirstName,
    lastName: rawLastName,
    name: rawName,
    department: rawDepartment,
    position: rawPosition,
    email: rawEmail,
    phone: rawPhone,
    photoFileName: rawPhotoFileName,
    faceDescriptor,
  } = req.body || {};

  const employeeId = normalizeText(rawEmployeeId).toUpperCase();
  const suppliedName = normalizeText(rawName);
  const nameParts = suppliedName.split(/\s+/).filter(Boolean);
  const firstName = normalizeText(rawFirstName) || nameParts.shift() || '';
  const lastName = normalizeText(rawLastName) || nameParts.join(' ');
  const department = normalizeText(rawDepartment);
  const position = normalizeText(rawPosition) || 'Employee';
  const email = normalizeText(rawEmail).toLowerCase();
  const phone = normalizeText(rawPhone);
  const photoFileName = normalizeText(rawPhotoFileName);

  if (!employeeId || employeeId.length > 64 || !firstName || !lastName || !department) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_EMPLOYEE',
      message: 'Employee ID, full name, and department are required.',
    });
  }
  if (firstName.length > 100 || lastName.length > 100 || department.length > 100
    || position.length > 100 || email.length > 254 || phone.length > 32 || photoFileName.length > 255) {
    return res.status(400).json({ success: false, code: 'INVALID_EMPLOYEE', message: 'One or more employee fields exceed the allowed length.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Email address is invalid.' });
  }
  if (!isValidFaceDescriptor(faceDescriptor)) {
    return res.status(400).json({ success: false, code: 'INVALID_FACE', message: 'The photo must produce one valid 128-value face descriptor.' });
  }

  try {
    const [existingProfile, existingUser] = await Promise.all([
      Employee.findOne({ employeeId }).select('+faceEncoding'),
      User.findOne({ employeeId }).select('fullName employeeRef isActive'),
    ]);

    if (existingUser && !existingUser.isActive) {
      return res.status(409).json({ success: false, code: 'INACTIVE_ACCOUNT', message: 'This employee account is inactive.' });
    }

    const duplicate = await findDuplicateFace(faceDescriptor, {
      excludeUserId: existingUser?._id,
      excludeEmployeeId: existingProfile?._id,
      excludeEmployeeCode: employeeId,
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_FACE',
        message: 'This face matches another registered employee.',
      });
    }

    const employee = existingProfile || new Employee({ employeeId });
    employee.firstName = firstName;
    employee.lastName = lastName;
    employee.department = department;
    employee.position = position;
    employee.email = email || undefined;
    employee.phone = phone;
    employee.faceEncoding = faceDescriptor;
    if (existingUser) employee.user = existingUser._id;
    await employee.save();

    if (existingUser) {
      existingUser.employeeRef = employee._id;
      await existingUser.updateOne({
        $set: {
          employeeRef: employee._id,
          faceDescriptor,
          fullName: `${firstName} ${lastName}`.trim(),
          name: `${firstName} ${lastName}`.trim(),
          department,
          position,
        },
      });
    }
    invalidateFaceCandidates();

    return res.status(existingProfile ? 200 : 201).json({
      success: true,
      message: existingProfile?.faceEncoding?.length === 128
        ? 'Employee face registration updated.'
        : 'Employee face registered.',
      data: {
        employee: employee.toJSON(),
        photoFileName,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_EMPLOYEE',
        message: 'Employee ID or email is already registered.',
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, code: 'INVALID_EMPLOYEE', message: error.message });
    }
    console.error('Bulk face registration failed:', error);
    return res.status(500).json({ success: false, code: 'REGISTRATION_FAILED', message: 'Unable to register this employee face.' });
  }
};

module.exports = { registerFace };
