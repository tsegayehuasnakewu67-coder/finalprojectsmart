const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getDefaultEmployeePassword } = require('./utils/passwordPolicy');

mongoose.set('autoIndex', false);

const employeesToSeed = [
  { employeeId: 'EMP001', firstName: 'Abebe', lastName: 'Kebede', department: 'IT', position: 'Systems Analyst' },
  { employeeId: 'EMP002', firstName: 'Hana', lastName: 'Tesfaye', department: 'Finance', position: 'Accountant' },
  { employeeId: 'EMP003', firstName: 'Dawit', lastName: 'Alemu', department: 'Human Resources', position: 'HR Officer' },
  { employeeId: 'EMP004', firstName: 'Selamawit', lastName: 'Bekele', department: 'Administration', position: 'Office Administrator' },
  { employeeId: 'EMP005', firstName: 'Mohammed', lastName: 'Ali', department: 'IT', position: 'Support Technician' },
  { employeeId: 'EMP006', firstName: 'Meron', lastName: 'Getachew', department: 'Finance', position: 'Financial Analyst' },
  { employeeId: 'EMP007', firstName: 'Yonas', lastName: 'Tadesse', department: 'Human Resources', position: 'Recruitment Officer' },
  { employeeId: 'EMP008', firstName: 'Rahel', lastName: 'Worku', department: 'Administration', position: 'Administrative Officer' },
  { employeeId: 'EMP009', firstName: 'Bethel', lastName: 'Girma', department: 'IT', position: 'Software Developer' },
  { employeeId: 'EMP010', firstName: 'Daniel', lastName: 'Mekonnen', department: 'Finance', position: 'Finance Officer' },
];

const attendanceStatuses = [
  ['Present', 'Late', 'Present', 'Present', 'Absent'],
  ['Present', 'Present', 'Late', 'Present', 'Leave'],
  ['Late', 'Present', 'Present', 'Absent', 'Present'],
  ['Present', 'Absent', 'Present', 'Late', 'Present'],
  ['Present', 'Present', 'Leave', 'Present', 'Late'],
  ['Absent', 'Present', 'Present', 'Late', 'Present'],
  ['Present', 'Leave', 'Present', 'Present', 'Late'],
  ['Late', 'Present', 'Absent', 'Present', 'Present'],
  ['Present', 'Late', 'Present', 'Leave', 'Present'],
  ['Present', 'Present', 'Late', 'Absent', 'Present'],
];

const emailFor = ({ firstName, lastName }) =>
  `${firstName}.${lastName}`.toLowerCase() + '@sample.smartattendance.local';

const recentWeekdays = (count) => {
  const dates = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.unshift(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
};

const dateAt = (date, time) => new Date(`${date}T${time}:00.000Z`);

const seedEmployees = async (User, syncEmployeeForUser) => {
  const users = [];
  const defaultPassword = getDefaultEmployeePassword();

  for (const sample of employeesToSeed) {
    const email = emailFor(sample);
    let user = await User.findOne({ employeeId: sample.employeeId });

    if (!user) {
      const emailOwner = await User.findOne({ email });
      if (emailOwner) {
        throw new Error(`Cannot seed ${sample.employeeId}: ${email} belongs to a different user.`);
      }
      user = new User({
        name: `${sample.firstName} ${sample.lastName}`,
        fullName: `${sample.firstName} ${sample.lastName}`,
        employeeId: sample.employeeId,
        email,
        password: defaultPassword,
        department: sample.department,
        position: sample.position,
        role: 'employee',
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: null,
      });
      await user.save();
    } else {
      const emailOwner = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailOwner) {
        throw new Error(`Cannot update ${sample.employeeId}: ${email} belongs to a different user.`);
      }
      user.name = `${sample.firstName} ${sample.lastName}`;
      user.fullName = user.name;
      user.email = email;
      user.department = sample.department;
      user.position = sample.position;
      user.role = 'employee';
      user.isActive = true;
      user.password = defaultPassword;
      user.mustChangePassword = true;
      user.passwordChangedAt = null;
      await user.save();
    }

    await syncEmployeeForUser(user);
    users.push(user);
  }
  return users;
};

const seedAttendance = async (Attendance, users, dates) => {
  for (let employeeIndex = 0; employeeIndex < users.length; employeeIndex += 1) {
    const user = users[employeeIndex];
    if (!user.employeeRef) {
      throw new Error(`Employee record is missing for ${user.employeeId}.`);
    }

    for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
      const date = dates[dayIndex];
      const status = attendanceStatuses[employeeIndex][dayIndex];
      const existing = await Attendance.findOne({ employeeId: user.employeeId, date });
      if (existing) {
        let changed = false;
        if (String(existing.employee || '') !== String(user.employeeRef)) {
          existing.employee = user.employeeRef;
          changed = true;
        }
        if (String(existing.userId || '') !== String(user._id)) {
          existing.userId = user._id;
          changed = true;
        }
        if (changed) await existing.save();
        continue;
      }

      const isPresent = status === 'Present' || status === 'Late';
      await Attendance.create({
        userId: user._id,
        employee: user.employeeRef,
        employeeId: user.employeeId,
        fullName: user.fullName,
        department: user.department,
        position: user.position,
        date,
        checkIn: isPresent ? dateAt(date, status === 'Late' ? '08:24' : '08:05') : null,
        checkOut: isPresent ? dateAt(date, '17:00') : null,
        status,
        recognitionMethod: 'Manual',
        lateMinutes: status === 'Late' ? 9 : 0,
        notes: 'Sample seed record',
      });
    }
  }
};

const seedLeaveRequests = async (LeaveRequest, users, admin) => {
  const byEmployeeId = new Map(users.map((user) => [user.employeeId, user]));
  const samples = [
    {
      employeeId: 'EMP003',
      type: 'annual',
      startDate: '2026-10-19',
      endDate: '2026-10-23',
      status: 'pending',
      reason: 'Sample seed: Annual leave for a family visit.',
    },
    {
      employeeId: 'EMP004',
      type: 'sick',
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      status: 'approved',
      reason: 'Sample seed: Sick leave for recovery.',
    },
    {
      employeeId: 'EMP007',
      type: 'annual',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      status: 'rejected',
      reason: 'Sample seed: Annual leave request during a restricted period.',
    },
  ];

  for (const sample of samples) {
    const employee = byEmployeeId.get(sample.employeeId);
    const isPending = sample.status === 'pending';
    await LeaveRequest.updateOne(
      { employee: employee._id, reason: sample.reason },
      {
        $set: {
          type: sample.type,
          startDate: sample.startDate,
          endDate: sample.endDate,
          status: sample.status,
          reviewedBy: isPending ? null : admin._id,
          reviewedAt: isPending ? null : new Date('2026-10-01T09:00:00.000Z'),
          reviewNote: isPending ? '' : sample.status === 'approved'
            ? 'Approved by the administrator.'
            : 'Please choose dates outside the restricted period.',
        },
        $setOnInsert: { reason: sample.reason },
      },
      { upsert: true, runValidators: true },
    );
  }
};

const seedNotifications = async (Notification, users, admin) => {
  const byEmployeeId = new Map(users.map((user) => [user.employeeId, user]));
  const samples = [
    {
      recipient: admin._id,
      type: 'message',
      subject: 'Sample - New leave request',
      message: 'Dawit Alemu (EMP003) submitted an annual leave request for October 19-23, 2026.',
    },
    {
      recipient: byEmployeeId.get('EMP001')._id,
      type: 'message',
      subject: 'Sample - Attendance marked',
      message: 'Your attendance record for the latest sample workday has been recorded.',
    },
    {
      recipient: byEmployeeId.get('EMP004')._id,
      type: 'message',
      subject: 'Sample - Leave request approved',
      message: 'Your sample sick leave request has been approved.',
    },
    {
      recipient: byEmployeeId.get('EMP006')._id,
      type: 'warning',
      subject: 'Sample - Late attendance notification',
      message: 'A sample late attendance record was recorded at 08:24.',
    },
    {
      recipient: admin._id,
      type: 'message',
      subject: 'Sample - System notification',
      message: 'Smart Attendance sample data initialization completed.',
    },
  ];

  for (const sample of samples) {
    await Notification.updateOne(
      { recipient: sample.recipient, sender: admin._id, subject: sample.subject },
      { $set: { type: sample.type, message: sample.message } },
      { upsert: true, runValidators: true },
    );
  }
};

const seedShiftSettings = async (ShiftSettings) => {
  await ShiftSettings.updateOne(
    { _key: 'default' },
    {
      $setOnInsert: {
        startHour: 8,
        startMinute: 0,
        gracePeriod: 15,
        endHour: 17,
        endMinute: 0,
        lunchEnabled: false,
        beforeLunchStartHour: 8,
        beforeLunchStartMinute: 0,
        beforeLunchEndHour: 12,
        beforeLunchEndMinute: 0,
        afterLunchStartHour: 13,
        afterLunchStartMinute: 0,
        afterLunchEndHour: 17,
        afterLunchEndMinute: 0,
        notifyCheckIn: true,
        notifyCheckOut: true,
      },
    },
    { upsert: true, runValidators: true },
  );
};

const preserveLegacyLeaveRequests = async () => {
  const database = mongoose.connection.db;
  const legacyName = 'leaverequests';
  const legacy = await database.listCollections({ name: legacyName }).toArray();
  if (!legacy.length) return;

  const source = database.collection(legacyName).find();
  const target = database.collection('leaveRequests');
  for await (const request of source) {
    const { _id, ...fields } = request;
    await target.updateOne(
      { _id },
      { $setOnInsert: fields },
      { upsert: true },
    );
  }
};

const repairLeaveRequestReferences = async (LeaveRequest, Employee, User) => {
  const users = await User.find().select('_id employeeId');
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const requests = await LeaveRequest.find();

  for (const request of requests) {
    if (usersById.has(String(request.employee))) continue;

    const employee = await Employee.findById(request.employee).select('employeeId user');
    const linkedUser = employee?.user ? usersById.get(String(employee.user)) : null;
    if (!linkedUser || linkedUser.employeeId !== employee.employeeId) {
      throw new Error(`Cannot safely resolve employee reference for leave request ${request._id}.`);
    }

    request.employee = linkedUser._id;
    await request.save();
  }
};

const main = async () => {
  try {
    await connectDB();

    const User = require('./models/User');
    const Employee = require('./models/Employee');
    const Attendance = require('./models/Attendance');
    const LeaveRequest = require('./models/LeaveRequest');
    const Notification = require('./models/Notification');
    const ShiftSettings = require('./models/ShiftSettings');
    const { syncEmployeeForUser } = require('./utils/employeeSync');
    const ensureAdmin = require('./utils/adminSeed');

    await preserveLegacyLeaveRequests();
    const admin = await ensureAdmin();
    const users = await seedEmployees(User, syncEmployeeForUser);
    const dates = recentWeekdays(5);

    await seedAttendance(Attendance, users, dates);
    await seedLeaveRequests(LeaveRequest, users, admin);
    await repairLeaveRequestReferences(LeaveRequest, Employee, User);
    await seedNotifications(Notification, users, admin);
    await seedShiftSettings(ShiftSettings);

    const [userCount, attendanceCount, leaveCount, notificationCount, shiftCount] = await Promise.all([
      User.countDocuments(),
      Attendance.countDocuments(),
      LeaveRequest.countDocuments(),
      Notification.countDocuments(),
      ShiftSettings.countDocuments(),
    ]);

    console.log('MongoDB Connected');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Users: ${userCount}`);
    console.log(`Attendance Records: ${attendanceCount}`);
    console.log(`Leave Requests: ${leaveCount}`);
    console.log(`Notifications: ${notificationCount}`);
    console.log(`Shift Settings: ${shiftCount}`);
    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Database seeding failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

main();
