const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const { getDefaultEmployeePassword } = require('./utils/passwordPolicy');
const connectDB = require('./config/db');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Attendance = require('./models/Attendance');
const Department = require('./models/Department');
const SystemSettings = require('./models/SystemSettings');
const ShiftSettings = require('./models/ShiftSettings');
const LeaveRequest = require('./models/LeaveRequest');
const Notification = require('./models/Notification');
const ensureAdmin = require('./utils/adminSeed');
const { syncEmployeeForUser } = require('./utils/employeeSync');
const migrateEmployees = require('./utils/migrateEmployees');

const employeeSeedList = [
  { employeeId: 'EMP001', firstName: 'Abebe', lastName: 'Kebede', email: 'abebe.kebede@smartattendance.local', department: 'IT', position: 'Systems Analyst', phone: '+251911000001' },
  { employeeId: 'EMP002', firstName: 'Hana', lastName: 'Tesfaye', email: 'hana.tesfaye@smartattendance.local', department: 'Finance', position: 'Accountant', phone: '+251911000002' },
  { employeeId: 'EMP003', firstName: 'Dawit', lastName: 'Alemu', email: 'dawit.alemu@smartattendance.local', department: 'Human Resources', position: 'HR Officer', phone: '+251911000003' },
  { employeeId: 'EMP004', firstName: 'Selamawit', lastName: 'Bekele', email: 'selamawit.bekele@smartattendance.local', department: 'Administration', position: 'Office Administrator', phone: '+251911000004' },
  { employeeId: 'EMP005', firstName: 'Mohammed', lastName: 'Ali', email: 'mohammed.ali@smartattendance.local', department: 'IT', position: 'Support Technician', phone: '+251911000005' },
  { employeeId: 'EMP006', firstName: 'Meron', lastName: 'Getachew', email: 'meron.getachew@smartattendance.local', department: 'Finance', position: 'Finance Officer', phone: '+251911000006' },
  { employeeId: 'EMP007', firstName: 'Yonas', lastName: 'Tadesse', email: 'yonas.tadesse@smartattendance.local', department: 'Human Resources', position: 'Recruitment Specialist', phone: '+251911000007' },
  { employeeId: 'EMP008', firstName: 'Rahel', lastName: 'Worku', email: 'rahel.worku@smartattendance.local', department: 'Administration', position: 'Admin Assistant', phone: '+251911000008' },
  { employeeId: 'EMP009', firstName: 'Bethel', lastName: 'Girma', email: 'bethel.girma@smartattendance.local', department: 'IT', position: 'Software Developer', phone: '+251911000009' },
  { employeeId: 'EMP010', firstName: 'Daniel', lastName: 'Mekonnen', email: 'daniel.mekonnen@smartattendance.local', department: 'Finance', position: 'Budget Analyst', phone: '+251911000010' },
];

const getRecentWorkingDays = (count) => {
  const dates = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
};

const main = async () => {
  try {
    await connectDB();
    await migrateEmployees();
    await Promise.all([
      User.init(),
      Employee.init(),
      Attendance.init(),
      Department.init(),
      SystemSettings.init(),
      ShiftSettings.init(),
      LeaveRequest.init(),
      Notification.init(),
    ]);

    const admin = await ensureAdmin();

    const departmentDescriptions = { IT: 'IT', Finance: 'Finance', 'Human Resources': 'HR', Administration: 'Admin' };
    for (const [name, desc] of Object.entries(departmentDescriptions)) {
      await Department.updateOne({ name }, { $setOnInsert: { name, description: desc } }, { upsert: true });
    }

    const employees = [];
    const defaultPassword = getDefaultEmployeePassword();
    for (const sample of employeeSeedList) {
      let employee = await Employee.findOne({ employeeId: sample.employeeId });
      if (!employee) {
        employee = await Employee.create({ ...sample, status: 'Active', faceEncoding: [] });
      }
      employees.push(employee);

      let user = await User.findOne({ employeeId: sample.employeeId });
      if (!user) {
        user = await User.create({
          fullName: `${sample.firstName} ${sample.lastName}`,
          name: `${sample.firstName} ${sample.lastName}`,
          employeeId: sample.employeeId,
          email: sample.email,
          password: defaultPassword,
          department: sample.department,
          position: sample.position,
          role: 'employee',
          isActive: true,
          mustChangePassword: true,
          passwordChangedAt: null,
        });
      } else {
        user.password = defaultPassword;
        user.mustChangePassword = true;
        user.passwordChangedAt = null;
        await user.save();
      }
      if (user) await syncEmployeeForUser(user);
    }

    await SystemSettings.updateOne({ key: 'default' }, { $setOnInsert: { systemName: 'Smart Attendance System' } }, { upsert: true });
    await ShiftSettings.updateOne(
      { _key: 'default' },
      {
        $setOnInsert: {
          _key: 'default',
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
      { upsert: true }
    );

    const dates = getRecentWorkingDays(5);
    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      const statuses = [['Present','Late','Present','Present','Absent'],['Present','Present','Late','Present','Leave'],['Late','Present','Present','Absent','Present'],['Present','Absent','Present','Late','Present'],['Present','Present','Leave','Present','Late'],['Present','Present','Present','Late','Present'],['Present','Late','Present','Present','Absent'],['Present','Present','Present','Absent','Present'],['Late','Present','Present','Present','Leave'],['Present','Present','Late','Present','Present']][i];
      for (let d = 0; d < dates.length; d++) {
        const dateStr = dates[d];
        const status = statuses[d];
        const existingAtt = await Attendance.findOne({ employeeId: employee.employeeId, date: dateStr });
        if (existingAtt) continue;
        let checkIn = null;
        if (status === 'Present') checkIn = new Date(dateStr + 'T08:25:00.000Z');
        else if (status === 'Late') checkIn = new Date(dateStr + 'T08:45:00.000Z');
        await Attendance.create({
          employee: employee._id,
          userId: employee.user || null,
          employeeId: employee.employeeId,
          fullName: employee.fullName,
          department: employee.department,
          position: employee.position,
          date: dateStr,
          checkIn,
          checkOut: (status === 'Present' || status === 'Late') ? new Date(dateStr + 'T17:00:00.000Z') : null,
          status,
          recognitionMethod: 'Manual',
          notes: 'Seeded attendance record',
        });
      }
    }

    const empMap = {};
    for (const emp of employees) empMap[emp.employeeId] = emp;
    const leaveRequestsToCreate = [];
    if (empMap['EMP003']) leaveRequestsToCreate.push({ employee: empMap['EMP003']._id, type: 'annual', startDate: dates[0], endDate: dates[1], reason: 'Annual leave request', status: 'pending' });
    if (empMap['EMP004']) leaveRequestsToCreate.push({ employee: empMap['EMP004']._id, type: 'sick', startDate: dates[2], endDate: dates[2], reason: 'Medical appointment', status: 'approved', reviewedBy: admin._id, reviewedAt: new Date(), reviewNote: 'Approved' });
    if (empMap['EMP007']) leaveRequestsToCreate.push({ employee: empMap['EMP007']._id, type: 'annual', startDate: dates[3], endDate: dates[3], reason: 'Personal leave', status: 'rejected', reviewedBy: admin._id, reviewedAt: new Date(), reviewNote: 'Rejected' });
    for (const lr of leaveRequestsToCreate) {
      const exists = await LeaveRequest.findOne({ employee: lr.employee, startDate: lr.startDate, endDate: lr.endDate, type: lr.type, status: lr.status });
      if (!exists) await LeaveRequest.create(lr);
    }

    const allUsers = await User.find({}).select('_id isActive role');
    const employeeUsers = allUsers.filter(u => u.role === 'employee' && u.isActive);
    const notificationsToCreate = [];
    for (const eu of employeeUsers.slice(0, 2)) {
      const exists = await Notification.findOne({ recipient: eu._id, subject: 'Welcome to Smart Attendance' });
      if (!exists) notificationsToCreate.push({ recipient: eu._id, sender: admin._id, type: 'message', subject: 'Welcome to Smart Attendance', message: 'Account set up' });
    }
    const existsAdminNotif = await Notification.findOne({ recipient: admin._id, subject: 'System Notification' });
    if (!existsAdminNotif) notificationsToCreate.push({ recipient: admin._id, sender: admin._id, type: 'message', subject: 'System Notification', message: 'Seeded' });
    for (const n of notificationsToCreate) await Notification.create(n);

    const userCount = await User.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    const leaveCount = await LeaveRequest.countDocuments();
    const notifCount = await Notification.countDocuments();
    const shiftCount = await ShiftSettings.countDocuments();

    console.log('\n=== FINAL SUMMARY ===');
    console.log('MongoDB Connected: true');
    console.log('Database: smart_attendance');
    console.log('Users:', userCount);
    console.log('Attendance Records:', attendanceCount);
    console.log('Leave Requests:', leaveCount);
    console.log('Notifications:', notifCount);
    console.log('Shift Settings:', shiftCount);
    console.log('Admin:', admin.email, '(Admin@123)');
    console.log('Seed: npm run seed');
    console.log('Backend: npm run dev (or npm start) in backEnd');
    console.log('Frontend: npm run dev in frontEnd');
    console.log('Status: All collections populated successfully');
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

main();
