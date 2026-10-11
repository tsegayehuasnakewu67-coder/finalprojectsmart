require('dotenv').config();
const mongoose = require('mongoose');
const { getDefaultEmployeePassword } = require('./utils/passwordPolicy');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function seedMissing() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    const User = require('./models/User');

    const missingEmployees = [
      { employeeId: 'EMP006', firstName: 'Meron',    lastName: 'Getachew', email: 'meron.getachew@smartattendance.local',  department: 'Finance',           position: 'Finance Officer',         phone: '+251911000006', role: 'employee' },
      { employeeId: 'EMP007', firstName: 'Yonas',    lastName: 'Tadesse',  email: 'yonas.tadesse@smartattendance.local',   department: 'Human Resources',   position: 'Recruitment Specialist',  phone: '+251911000007', role: 'employee' },
      { employeeId: 'EMP008', firstName: 'Rahel',    lastName: 'Worku',    email: 'rahel.worku@smartattendance.local',     department: 'Administration',    position: 'Admin Assistant',         phone: '+251911000008', role: 'employee' },
      { employeeId: 'EMP009', firstName: 'Bethel',   lastName: 'Girma',    email: 'bethel.girma@smartattendance.local',    department: 'IT',                position: 'Software Developer',      phone: '+251911000009', role: 'employee' },
      { employeeId: 'EMP010', firstName: 'Daniel',   lastName: 'Mekonnen', email: 'daniel.mekonnen@smartattendance.local', department: 'Finance',           position: 'Budget Analyst',          phone: '+251911000010', role: 'employee' },
      { employeeId: 'MAU1608989', firstName: 'yedenek', lastName: 'genanew', email: 'yedenek@gmail.com',                  department: 'Information Technology', position: 'Director',           phone: '+251911000011', role: 'employee' },
      { employeeId: 'MAU1601224', firstName: 'desalegn', lastName: 'getawun', email: 'desalegn@gmail.com',                department: 'Construction Technology and Management', position: 'Registrar', phone: '+251911000012', role: 'hr' }
    ];

    const defaultPassword = getDefaultEmployeePassword();

    let added = 0;
    let skipped = 0;

    for (const emp of missingEmployees) {
      const exists = await User.findOne({ 
  $or: [
    { email: emp.email },
    { employeeId: emp.employeeId }
  ]
});
      if (exists) {
        console.log('Skipped (exists):', emp.email);
        skipped++;
        continue;
      }

      const fullName = emp.firstName + ' ' + emp.lastName;
      await User.create({
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: fullName,
        name: fullName,
        email: emp.email,
        password: defaultPassword,
        department: emp.department,
        position: emp.position,
        phone: emp.phone,
        role: emp.role || 'employee',
        isActive: true,
        mustChangePassword: (emp.role || 'employee') === 'employee',
        passwordChangedAt: null,
        faceDescriptor: []
      });
      console.log('Created:', fullName, '(' + emp.email + ')');
      added++;
    }

    console.log('\nDone!');
    console.log('Added:', added);
    console.log('Skipped:', skipped);
    console.log('All passwords: Employee@123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seedMissing();
