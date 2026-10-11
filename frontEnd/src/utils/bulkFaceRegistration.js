import Papa from 'papaparse';

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 1000;

const REQUIRED_COLUMNS = ['employeeid', 'name', 'department', 'photofilename'];
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const PHOTO_EXTENSIONS = /\.(jpe?g|png)$/i;

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
const asText = (value) => String(value ?? '').trim();
const fileKey = (value) => asText(value).split(/[\\/]/).pop().toLowerCase();

export const validateCsvFile = (file) => {
  if (!file) return 'Select a CSV file.';
  if (!file.name.toLowerCase().endsWith('.csv')) return 'The employee list must be a .csv file.';
  if (file.size > MAX_CSV_BYTES) return 'The CSV file must be 5 MB or smaller.';
  return '';
};

export const validatePhotoFile = (file) => {
  if (!PHOTO_EXTENSIONS.test(file.name) || !PHOTO_TYPES.has(file.type)) {
    return 'Only JPG and PNG photos are supported.';
  }
  if (file.size > MAX_PHOTO_BYTES) return 'Each photo must be 5 MB or smaller.';
  return '';
};

export const parseEmployeeCsv = (file) => new Promise((resolve, reject) => {
  const fileError = validateCsvFile(file);
  if (fileError) {
    reject(new Error(fileError));
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    complete: ({ data, errors, meta }) => {
      if (errors.length) {
        reject(new Error(`Unable to parse CSV: ${errors[0].message}`));
        return;
      }

      const normalizedHeaders = meta.fields.map(normalizeHeader);
      const duplicates = normalizedHeaders.filter((header, index) => normalizedHeaders.indexOf(header) !== index);
      if (duplicates.length) {
        reject(new Error(`Duplicate CSV column: ${duplicates[0]}.`));
        return;
      }
      const missing = REQUIRED_COLUMNS.filter((column) => !normalizedHeaders.includes(column));
      if (missing.length) {
        reject(new Error(`CSV is missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`));
        return;
      }
      if (data.length > MAX_CSV_ROWS) {
        reject(new Error(`The CSV may contain at most ${MAX_CSV_ROWS} employee rows.`));
        return;
      }

      const rows = data.map((record, index) => {
        const values = Object.fromEntries(
          Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]),
        );
        const name = asText(values.name || [values.firstname, values.lastname].filter(Boolean).join(' '));
        const employee = {
          employeeId: asText(values.employeeid).toUpperCase(),
          name,
          firstName: asText(values.firstname) || name.split(/\s+/)[0] || '',
          lastName: asText(values.lastname) || name.split(/\s+/).slice(1).join(' '),
          department: asText(values.department),
          position: asText(values.position) || 'Employee',
          email: asText(values.email).toLowerCase(),
          phone: asText(values.phone),
          photoFileName: asText(values.photofilename),
        };
        const errors = [];
        if (!employee.employeeId) errors.push('Employee ID is required.');
        if (!employee.name) errors.push('Name is required.');
        if (!employee.department) errors.push('Department is required.');
        if (!employee.photoFileName) errors.push('photoFileName is required.');
        if (employee.employeeId.length > 64) errors.push('Employee ID must be 64 characters or fewer.');
        if (employee.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) errors.push('Email address is invalid.');

        return {
          rowNumber: index + 2,
          ...employee,
          photo: null,
          photoStatus: 'Pending',
          valid: errors.length === 0,
          errors,
        };
      });

      const idCounts = new Map();
      rows.forEach((row) => idCounts.set(row.employeeId, (idCounts.get(row.employeeId) || 0) + 1));
      rows.forEach((row) => {
        if (row.employeeId && idCounts.get(row.employeeId) > 1) {
          row.errors.push('Employee ID is duplicated in this CSV.');
          row.valid = false;
        }
      });

      resolve(rows);
    },
    error: (error) => reject(new Error(error.message || 'Unable to read this CSV file.')),
  });
});

export const validatePhotoMatches = (rows, files) => {
  const photosByName = new Map();
  const duplicateNames = new Set();
  const fileErrors = new Map();

  files.forEach((file) => {
    const key = fileKey(file.name);
    const error = validatePhotoFile(file);
    if (error) fileErrors.set(key, error);
    if (photosByName.has(key)) duplicateNames.add(key);
    else photosByName.set(key, file);
  });

  const rowsByPhotoName = new Map();
  rows.forEach((row) => {
    const key = fileKey(row.photoFileName);
    if (!key) return;
    rowsByPhotoName.set(key, (rowsByPhotoName.get(key) || 0) + 1);
  });

  return rows.map((source) => {
    const row = { ...source, errors: [...source.errors] };
    const key = fileKey(row.photoFileName);
    const photo = photosByName.get(key);
    if (!photo) {
      row.errors.push(`Photo "${row.photoFileName || '(missing)'}" was not uploaded.`);
      row.photoStatus = 'Missing';
    } else if (fileErrors.has(key)) {
      row.errors.push(fileErrors.get(key));
      row.photoStatus = 'Invalid';
    } else if (duplicateNames.has(key) || rowsByPhotoName.get(key) > 1) {
      row.errors.push(`Photo filename "${row.photoFileName}" must match exactly one employee.`);
      row.photoStatus = 'Ambiguous';
    } else {
      row.photo = photo;
      row.photoStatus = 'Ready';
    }
    row.valid = row.errors.length === 0;
    return row;
  });
};

export const summarizeRows = (rows) => ({
  total: rows.length,
  valid: rows.filter((row) => row.valid).length,
  invalid: rows.filter((row) => !row.valid).length,
});

export const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildResultCsv = (results) => {
  const header = ['fileName', 'status', 'name', 'error', 'timestamp'];
  const body = results.map((result) => [
    result.fileName,
    result.status,
    result.name,
    result.error,
    result.timestamp,
  ]);
  return `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
};
