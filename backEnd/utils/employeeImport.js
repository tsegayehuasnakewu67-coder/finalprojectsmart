const XLSX = require('xlsx');
const { euclideanDistance } = require('./faceMatcher');

const MAX_ROWS = 1000;
const REQUIRED_HEADERS = ['employeeid', 'firstname', 'lastname', 'email', 'department', 'position'];
const STATUS_VALUES = new Set(['Active', 'Inactive', 'On Leave']);

const normalizeHeader = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const isBlankRow = (row) => row.every((cell) => String(cell ?? '').trim() === '');

const parseCsv = (buffer) => {
  let workbook;
  try {
    const csvBuffer = buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))
      ? buffer.subarray(3)
      : buffer;
    workbook = XLSX.read(csvBuffer, { type: 'buffer', raw: false, codepage: 65001 });
  } catch {
    throw new Error('The uploaded CSV could not be read. Check its format and try again.');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('The CSV file is empty.');

  const values = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: true,
  });
  const headerIndex = values.findIndex((row) => !isBlankRow(row));
  if (headerIndex < 0) throw new Error('The CSV file is empty.');

  const headers = values[headerIndex].map(normalizeHeader);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}.`);
  }

  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicateHeaders.length) {
    throw new Error(`Duplicate column headings: ${[...new Set(duplicateHeaders)].join(', ')}.`);
  }

  const rows = values
    .slice(headerIndex + 1)
    .map((cells, index) => ({
      rowNumber: headerIndex + index + 2,
      employee: Object.fromEntries(headers
        .map((header, column) => [header, cells[column] ?? ''])
        .filter(([header]) => header)),
    }))
    .filter(({ employee }) => Object.values(employee).some((value) => String(value ?? '').trim()));

  if (rows.length > MAX_ROWS) {
    throw new Error(`A CSV file may contain at most ${MAX_ROWS} employee rows.`);
  }

  return rows;
};

const validDate = (value) => {
  if (!value) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const stringField = (value) => (value == null ? '' : String(value).trim());

const dateField = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return stringField(value);
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return String(value);
  return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
};

const normalizeEmployee = (source = {}) => {
  const normalized = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [normalizeHeader(key), value]),
  );
  const employeeId = stringField(normalized.employeeid).toUpperCase();
  const email = stringField(normalized.email).toLowerCase();
  const statusInput = stringField(normalized.status);

  return {
    employeeId,
    firstName: stringField(normalized.firstname),
    lastName: stringField(normalized.lastname),
    email,
    phone: stringField(normalized.phone),
    department: stringField(normalized.department),
    position: stringField(normalized.position),
    gender: stringField(normalized.gender),
    dateOfBirth: dateField(normalized.dateofbirth),
    address: stringField(normalized.address),
    photoFileName: stringField(normalized.photofilename),
    status: statusInput || 'Active',
    faceEncoding: normalized.faceencoding ?? [],
  };
};

const validateEmployeeFields = (employee) => {
  const errors = [];
  const required = [
    ['employeeId', 'Employee ID'],
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['email', 'Email'],
    ['department', 'Department'],
    ['position', 'Position'],
  ];

  for (const [field, label] of required) {
    if (!employee[field]) errors.push(`${label} is required.`);
  }

  const limits = [
    ['employeeId', 64, 'Employee ID'],
    ['firstName', 100, 'First name'],
    ['lastName', 100, 'Last name'],
    ['email', 254, 'Email'],
    ['phone', 32, 'Phone'],
    ['department', 100, 'Department'],
    ['position', 100, 'Position'],
    ['gender', 40, 'Gender'],
    ['address', 300, 'Address'],
    ['photoFileName', 255, 'Photo file name'],
  ];
  for (const [field, maxLength, label] of limits) {
    if (employee[field].length > maxLength) errors.push(`${label} must be ${maxLength} characters or fewer.`);
  }

  if (employee.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
    errors.push('Email address is invalid.');
  }
  if (employee.dateOfBirth && !validDate(employee.dateOfBirth)) {
    errors.push('Date of birth must use the YYYY-MM-DD format and be a real date.');
  }
  if (!STATUS_VALUES.has(employee.status)) {
    errors.push('Status must be Active, Inactive, or On Leave.');
  }

  return errors;
};

const isValidFaceEncoding = (encoding) => Array.isArray(encoding)
  && encoding.length === 128
  && encoding.every((value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 2);

const validateEmployeeRows = async (rows, { Employee, User, requireFace = false }) => {
  const normalizedRows = rows.map(({ rowNumber, employee }) => {
    const normalizedEmployee = normalizeEmployee(employee);
    return {
      rowNumber,
      employee: normalizedEmployee,
      errors: validateEmployeeFields(normalizedEmployee),
    };
  });

  const ids = normalizedRows.map(({ employee }) => employee.employeeId).filter(Boolean);
  const emails = normalizedRows.map(({ employee }) => employee.email).filter(Boolean);
  const idCounts = new Map();
  const emailCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  for (const email of emails) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);

  const existingQuery = {
    $or: [
      ...(ids.length ? [{ employeeId: { $in: ids } }] : []),
      ...(emails.length ? [{ email: { $in: emails } }] : []),
    ],
  };
  const [existingEmployees, existingUsers] = ids.length || emails.length
    ? await Promise.all([
      Employee.find(existingQuery).select('employeeId email').lean(),
      User.find(existingQuery).select('employeeId email').lean(),
    ])
    : [[], []];

  const existingIds = new Set([
    ...existingEmployees.map(({ employeeId }) => String(employeeId).toUpperCase()),
    ...existingUsers.map(({ employeeId }) => String(employeeId).toUpperCase()),
  ]);
  const existingEmails = new Set([
    ...existingEmployees.map(({ email }) => String(email || '').toLowerCase()).filter(Boolean),
    ...existingUsers.map(({ email }) => String(email || '').toLowerCase()).filter(Boolean),
  ]);

  for (const row of normalizedRows) {
    const { employee } = row;
    if (!Array.isArray(employee.faceEncoding)) {
      row.errors.push('Face descriptor must be a 128-number array.');
    } else if (employee.faceEncoding.length && !isValidFaceEncoding(employee.faceEncoding)) {
      row.errors.push('Face descriptor must contain 128 finite numbers.');
    } else if (requireFace && !employee.faceEncoding.length) {
      row.errors.push('A face photo is required for every row in this batch.');
    }
    if (employee.employeeId && idCounts.get(employee.employeeId) > 1) {
      row.errors.push('Employee ID is duplicated in this file.');
    } else if (employee.employeeId && existingIds.has(employee.employeeId)) {
      row.errors.push('Employee ID already exists.');
    }

    if (employee.email && emailCounts.get(employee.email) > 1) {
      row.errors.push('Email is duplicated in this file.');
    } else if (employee.email && existingEmails.has(employee.email)) {
      row.errors.push('Email already exists.');
    }
  }

  const encodedRows = normalizedRows.filter(({ employee }) => isValidFaceEncoding(employee.faceEncoding));
  if (encodedRows.length) {
    const [employeesWithFaces, usersWithFaces] = await Promise.all([
      Employee.find({ 'faceEncoding.0': { $exists: true } }).select('+faceEncoding').lean(),
      User.find({ 'faceDescriptor.0': { $exists: true } }).select('faceDescriptor').lean(),
    ]);
    const registeredFaces = [
      ...employeesWithFaces.map(({ faceEncoding }) => faceEncoding),
      ...usersWithFaces.map(({ faceDescriptor }) => faceDescriptor),
    ].filter(isValidFaceEncoding);

    for (let index = 0; index < encodedRows.length; index += 1) {
      const row = encodedRows[index];
      const duplicateInBatch = encodedRows.some((other, otherIndex) => (
        otherIndex !== index
        && euclideanDistance(row.employee.faceEncoding, other.employee.faceEncoding) <= 0.5
      ));
      const duplicateRegistered = registeredFaces.some((face) => (
        euclideanDistance(row.employee.faceEncoding, face) <= 0.5
      ));
      if (duplicateInBatch || duplicateRegistered) {
        row.errors.push('This face is already registered.');
      }
    }
  }

  for (const row of normalizedRows) row.valid = row.errors.length === 0;
  return normalizedRows;
};

module.exports = { MAX_ROWS, parseCsv, validateEmployeeRows };
