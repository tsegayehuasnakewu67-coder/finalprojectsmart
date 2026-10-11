const Employee = require('../models/Employee');
const User = require('../models/User');
const { parseCsv, validateEmployeeRows } = require('../utils/employeeImport');

const isValidImageSignature = ({ originalname, buffer }) => {
  const extension = originalname.toLowerCase().split('.').pop();
  if (['jpg', 'jpeg'].includes(extension)) {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return extension === 'png'
    && buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
};

const previewBulkFaces = async (req, res, next) => {
  const csv = req.files?.csv?.[0];
  const photos = req.files?.photos || [];
  if (!csv) {
    return res.status(400).json({
      success: false,
      error: { code: 'CSV_REQUIRED', message: 'Upload one CSV file in the "csv" field.' },
      message: 'Upload one CSV file in the "csv" field.',
    });
  }

  let rows;
  try {
    rows = parseCsv(csv.buffer);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CSV', message: error.message },
      message: error.message,
    });
  }
  try {
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'The CSV has no employee rows.' });
    }
    if (rows.some(({ employee }) => !Object.prototype.hasOwnProperty.call(employee, 'photofilename'))) {
      return res.status(400).json({
        success: false,
        message: 'The CSV must include a photoFileName column.',
      });
    }

    const photoCounts = new Map();
    const photoByName = new Map();
    for (const photo of photos) {
      const key = photo.originalname.trim().toLowerCase();
      photoCounts.set(key, (photoCounts.get(key) || 0) + 1);
      photoByName.set(key, {
        originalname: photo.originalname,
        isValidImage: isValidImageSignature(photo),
      });
    }

    const validatedRows = await validateEmployeeRows(rows, { Employee, User });
    for (const row of validatedRows) {
      const photoFileName = String(row.employee.photoFileName || '').trim();
      const key = photoFileName.toLowerCase();
      if (!photoFileName) {
        row.errors.push('Photo file name is required.');
      } else if (!photoCounts.has(key)) {
        row.errors.push('Matching photo was not uploaded.');
      } else if (photoCounts.get(key) > 1) {
        row.errors.push('More than one uploaded photo has this file name.');
      } else if (!photoByName.get(key).isValidImage) {
        row.errors.push('Uploaded photo content does not match a valid JPG/PNG image.');
        row.photo = { fileName: photoByName.get(key).originalname, status: 'invalid' };
      } else {
        row.photo = { fileName: photoByName.get(key).originalname, status: 'matched' };
      }
      row.valid = row.errors.length === 0;
    }

    const valid = validatedRows.filter(({ valid: isValid }) => isValid).length;
    return res.json({
      success: true,
      data: {
        total: validatedRows.length,
        valid,
        invalid: validatedRows.length - valid,
        photosNotReferenced: photos
          .filter((photo) => !validatedRows.some(({ employee }) => (
            String(employee.photoFileName || '').trim().toLowerCase() === photo.originalname.trim().toLowerCase()
          )))
          .map(({ originalname }) => originalname),
        rows: validatedRows.map(({ rowNumber, employee, errors, valid: isValid, photo }) => ({
          rowNumber,
          employee: {
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            department: employee.department,
            position: employee.position,
            photoFileName: employee.photoFileName,
          },
          photo: photo || { fileName: employee.photoFileName || '', status: 'missing' },
          valid: isValid,
          errors,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { previewBulkFaces };
