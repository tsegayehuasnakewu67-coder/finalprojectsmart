const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const {
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
} = require('../controllers/employeeController');
const {
  previewEmployeeImport, importEmployees,
} = require('../controllers/employeeImportController');
const { protect, adminOrHR, adminOnly } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/requestValidation');
const {
  employeeIdParam, listEmployeesQuery, createEmployeeBody, updateEmployeeBody,
} = require('../validators/employeeValidators');

router.use(protect, adminOrHR);
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      const error = new Error('Upload a .csv file.');
      error.status = 400;
      error.code = 'INVALID_UPLOAD_TYPE';
      return callback(error);
    }
    return callback(null, true);
  },
});

const parseCsvUpload = (req, res, next) => csvUpload.single('file')(req, res, (error) => {
  if (!error) return next();
  if (!error.status) error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  if (error.code === 'LIMIT_FILE_SIZE') error.message = 'CSV files must be 5 MB or smaller.';
  return next(error);
});

router.post('/bulk/preview', adminOnly, parseCsvUpload, previewEmployeeImport);
router.post('/bulk/import', adminOnly, importEmployees);
router.get('/', listEmployeesQuery, validateRequest, listEmployees);
router.get('/:id', employeeIdParam, validateRequest, getEmployee);
router.post('/', adminOnly, createEmployeeBody, validateRequest, createEmployee);
router.put('/:id', adminOnly, employeeIdParam, updateEmployeeBody, validateRequest, updateEmployee);
router.delete('/:id', adminOnly, employeeIdParam, validateRequest, deleteEmployee);

module.exports = router;
