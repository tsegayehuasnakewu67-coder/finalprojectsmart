require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getDefaultEmployeePassword } = require('./utils/passwordPolicy');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function seedDirect() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    // የ collection ስም በቀጥታ ይጠቀሙ
    const db = mongoose.connection.db;
    const collection = db.collection('users');  // ← ስሙን ያረጋግጡ

    // አሁን ያሉትን ያሳዩ
    const count = await collection.countDocuments();
    console.log('Current documents in users:', count);

    // ሁሉንም ያሳዩ
    const all = await collection.find({}).project({ email: 1, employeeId: 1, fullName: 1 }).toArray();
    console.log('\nExisting users:');
    all.forEach(u => console.log('  -', u.employeeId, u.email, u.fullName));

    // አዲስ ለመጨመር
    const defaultPassword = getDefaultEmployeePassword();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const missingEmployees = [
      { employeeId: 'EMP006', firstName: 'Meron',    lastName: 'Getachew', email: 'meron.getachew@smartattendance.local',  department: 'Finance',           position: 'Finance Officer',         phone: '+251911000006', role: 'employee' },
      { employeeId: 'EMP007', firstName: 'Yonas',    lastName: 'Tadesse',  email: 'yonas.tadesse@smartattendance.local',   department: 'Human Resources',   position: 'Recruitment Specialist',  phone: '+251911000007', role: 'employee' },
      { employeeId: 'EMP008', firstName: 'Rahel',    lastName: 'Worku',    email: 'rahel.worku@smartattendance.local',     department: 'Administration',    position: 'Admin Assistant',         phone: '+251911000008', role: 'employee' },
      { employeeId: 'EMP009', firstName: 'Bethel',   lastName: 'Girma',    email: 'bethel.girma@smartattendance.local',    department: 'IT',                position: 'Software Developer',      phone: '+251911000009', role: 'employee' },
      { employeeId: 'EMP010', firstName: 'Daniel',   lastName: 'Mekonnen', email: 'daniel.mekonnen@smartattendance.local', department: 'Finance',           position: 'Budget Analyst',          phone: '+251911000010', role: 'employee' },
      { employeeId: 'MAU1608989', firstName: 'yedenek', lastName: 'genanew', email: 'yedenek@gmail.com',                  department: 'Information Technology', position: 'Director',           phone: '+251911000011', role: 'employee' },
      { employeeId: 'MAU1601224', firstName: 'desalegn', lastName: 'getawun', email: 'desalegn@gmail.com',                department: 'Construction Technology and Management', position: 'Registrar', phone: '+251911000012', role: 'hr' }
    ];

    let added = 0;
    let skipped = 0;

    console.log('\n--- Seeding ---');
    for (const emp of missingEmployees) {
      // በቀጥታ ይፈልጉ
      const existing = await collection.findOne({ employeeId: emp.employeeId });
      if (existing) {
        console.log('SKIP (exists in DB):', emp.employeeId, existing.email);
        skipped++;
        continue;
      }

      const fullName = emp.firstName + ' ' + emp.lastName;
      await collection.insertOne({
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: fullName,
        name: fullName,
        email: emp.email,
        password: hashedPassword,
        department: emp.department,
        position: emp.position,
        phone: emp.phone,
        role: emp.role || 'employee',
        isActive: true,
        mustChangePassword: (emp.role || 'employee') === 'employee',
        passwordChangedAt: null,
        faceDescriptor: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      });
      console.log('CREATED:', fullName, '(' + emp.email + ')');
      added++;
    }

    const finalCount = await collection.countDocuments();
    console.log('\n=== Summary ===');
    console.log('Added:', added);
    console.log('Skipped:', skipped);
    console.log('Total documents now:', finalCount);
    console.log('Password for all: Employee@123');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seedDirect();