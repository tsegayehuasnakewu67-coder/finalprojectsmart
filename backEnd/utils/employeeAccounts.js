const User = require('../models/User');
const { getDefaultEmployeePassword } = require('./passwordPolicy');

const accountError = (message, status = 400) => Object.assign(new Error(message), { status });

const ensureEmployeeLogin = async (employee) => {
  const employeeId = String(employee.employeeId || '').trim().toUpperCase();
  const email = String(employee.email || '').trim().toLowerCase();
  if (!employeeId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw accountError('A valid email address is required to create an employee login account.');
  }

  const [byId, byEmail] = await Promise.all([
    User.findOne({ employeeId }),
    User.findOne({ email }),
  ]);
  if (byId && byEmail && String(byId._id) !== String(byEmail._id)) {
    throw accountError('Employee ID and email are already assigned to different accounts.', 409);
  }

  const existing = byId || byEmail;
  if (existing) {
    if (existing.role !== 'employee' || existing.employeeId !== employeeId) {
      throw accountError('Employee ID or email is already assigned to another account.', 409);
    }
    if (existing.email !== email) {
      const emailInUse = await User.exists({ email, _id: { $ne: existing._id } });
      if (emailInUse) throw accountError('Email is already assigned to another account.', 409);
      existing.email = email;
    }
    existing.fullName = employee.fullName || `${employee.firstName} ${employee.lastName}`.trim();
    existing.name = existing.fullName;
    existing.department = employee.department;
    existing.position = employee.position;
    existing.employeeRef = employee._id;
    existing.isActive = employee.status === 'Active';
    await existing.save();
    await employee.updateOne({ $set: { user: existing._id } });
    return { user: existing, created: false };
  }

  let password;
  try {
    password = getDefaultEmployeePassword();
  } catch (error) {
    throw accountError('Employee login creation is not configured on the server.', 503);
  }
  const fullName = employee.fullName || `${employee.firstName} ${employee.lastName}`.trim();
  let user;
  try {
    user = await User.create({
      name: fullName,
      fullName,
      employeeId,
      email,
      password,
      department: employee.department,
      position: employee.position,
      role: 'employee',
      employeeRef: employee._id,
      faceDescriptor: employee.faceEncoding || [],
      isActive: employee.status === 'Active',
      mustChangePassword: true,
    });
    await employee.updateOne({ $set: { user: user._id } });
    return { user, created: true };
  } catch (error) {
    if (user?._id) await User.deleteOne({ _id: user._id });
    throw error;
  }
};

module.exports = { ensureEmployeeLogin };
