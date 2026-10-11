const Employee = require('../models/Employee');
const User = require('../models/User');
const { MAX_ROWS, parseCsv, validateEmployeeRows } = require('../utils/employeeImport');
const { invalidateFaceCandidates } = require('../services/faceRecognitionService');
const { ensureEmployeeLogin } = require('../utils/employeeAccounts');
const { getDefaultEmployeePassword } = require('../utils/passwordPolicy');

const summarize = (rows) => ({
  total: rows.length,
  valid: rows.filter((row) => row.valid).length,
  invalid: rows.filter((row) => !row.valid).length,
});

const getCsvRows = (req) => {
  if (!req.file) throw new Error('Choose a CSV file to upload.');
  return parseCsv(req.file.buffer);
};

const previewEmployeeImport = async (req, res) => {
  try {
    const rows = getCsvRows(req);
    const validatedRows = await validateEmployeeRows(rows, { Employee, User });
    return res.json({
      success: true,
      data: { rows: validatedRows, summary: summarize(validatedRows) },
    });
  } catch (error) {
    if (error.message.startsWith('Missing required columns:')
      || error.message.startsWith('Duplicate column headings:')
      || error.message.startsWith('A CSV file may contain')
      || error.message.startsWith('The CSV file is empty.')
      || error.message.startsWith('The uploaded CSV could not be read.')
      || error.message === 'Choose a CSV file to upload.') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Employee CSV preview failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to validate this employee file.' });
  }
};

const importEmployees = async (req, res) => {
  const { rows, requireFace = false } = req.body || {};
  if (typeof requireFace !== 'boolean') {
    return res.status(400).json({ success: false, message: 'requireFace must be a boolean.' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'Preview employee rows before importing.' });
  }
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ success: false, message: `A CSV file may contain at most ${MAX_ROWS} employee rows.` });
  }

  const importRows = rows.map((row, index) => ({
    rowNumber: Number.isInteger(row?.rowNumber) && row.rowNumber > 1 ? row.rowNumber : index + 2,
    employee: row?.employee && typeof row.employee === 'object' ? row.employee : {},
  }));

  try {
    const validatedRows = await validateEmployeeRows(importRows, { Employee, User, requireFace });
    const readyRows = validatedRows.filter((row) => row.valid);
    if (!readyRows.length) {
      return res.status(422).json({
        success: false,
        message: 'No valid employee rows are available to import.',
        data: { rows: validatedRows, summary: summarize(validatedRows), imported: 0 },
      });
    }
    try {
      getDefaultEmployeePassword();
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Employee account creation is not configured on the server.',
      });
    }

    const documents = readyRows.map(({ employee }) => {
      const employeeFields = { ...employee };
      delete employeeFields.photoFileName;
      const document = {
        ...employeeFields,
        dateOfBirth: employee.dateOfBirth ? new Date(`${employee.dateOfBirth}T00:00:00.000Z`) : null,
        faceEncoding: employee.faceEncoding,
        user: null,
      };
      if (!employee.email) delete document.email;
      return document;
    });

    try {
      await Employee.insertMany(documents, { ordered: false });
    } catch (error) {
      const writeErrors = error.writeErrors || error.result?.getWriteErrors?.() || [];
      if (!writeErrors.length || !writeErrors.every((writeError) => writeError.code === 11000)) {
        throw error;
      }

      const rejectedIndexes = new Map(writeErrors.map((writeError) => [
        writeError.index,
        writeError.err?.keyValue || writeError.keyValue || {},
      ]));
      for (const [index, keyValue] of rejectedIndexes) {
        const row = readyRows[index];
        if (!row) continue;
        const field = Object.keys(keyValue)[0];
        row.errors.push(field === 'email' ? 'Email already exists.' : 'Employee ID already exists.');
        row.valid = false;
      }
    }

    for (const row of readyRows.filter((candidate) => candidate.valid)) {
      const employee = await Employee.findOne({ employeeId: row.employee.employeeId });
      try {
        if (!employee) throw new Error('Employee profile was not saved.');
        const account = await ensureEmployeeLogin(employee);
        row.loginCreated = account.created;
      } catch (error) {
        row.errors.push(`Login account could not be created: ${error.message}`);
        row.valid = false;
        if (employee) await Employee.deleteOne({ _id: employee._id });
      }
    }

    const importedIds = new Set(readyRows
      .filter((row) => row.valid)
      .map((row) => row.employee.employeeId));
    const responseRows = validatedRows.map((row) => {
      const employee = { ...row.employee };
      delete employee.faceEncoding;
      return {
        ...row,
        employee,
        imported: row.valid && importedIds.has(row.employee.employeeId),
      };
    });
    const imported = responseRows.filter((row) => row.imported).length;
    const summary = summarize(responseRows);
    if (imported) invalidateFaceCandidates();

    return res.status(201).json({
      success: true,
      message: `${imported} employee${imported === 1 ? '' : 's'} imported with login accounts.`,
      data: {
        rows: responseRows,
        summary,
        imported,
        accountsCreated: responseRows.filter((row) => row.imported && row.loginCreated).length,
      },
    });
  } catch (error) {
    console.error('Employee bulk import failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to import employees. Please try again.' });
  }
};

module.exports = { previewEmployeeImport, importEmployees };
