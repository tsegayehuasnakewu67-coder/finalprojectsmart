
const router = require('express').Router();
const {
  markAttendance, checkOutAttendance, getKioskStatus,
  getCompanyAttendance, getMyAttendance, getDashboard, getMyStats,
  getAnalytics,
} = require('../controllers/attendanceController');
const {
  listAttendance, getAttendance, createAttendance, updateAttendance, deleteAttendance,
  getEmployeeAttendance, getDateAttendance,
} = require('../controllers/attendanceCrudController');
const { issueLivenessChallenge } = require('../utils/livenessChallenge');
const { protect, adminOnly, adminOrHR, employeeOrAdmin } = require('../middleware/authMiddleware');
const {
  getTodayAttendance, getAttendanceReport, exportAttendanceReport,
} = require('../controllers/attendanceReportController');
const { query, body, param } = require('express-validator');
const { validateRequest } = require('../middleware/requestValidation');
const { attendanceScanRateLimit } = require('../middleware/apiSecurity');

const reportValidators = [
  query('from').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('from must use YYYY-MM-DD.'),
  query('to').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('to must use YYYY-MM-DD.'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('status').optional().isIn(['Present', 'Late', 'Absent', 'Leave']),
  query('department').optional().isString().trim().isLength({ max: 100 }),
  query('employeeId').optional().isString().trim().isLength({ max: 64 }),
];
const faceScanBodyValidators = [
  body('faceDescriptor').isArray({ min: 128, max: 128 }),
  body('faceDescriptor.*').isFloat({ min: -2, max: 2 }),
  body('livenessProof').isObject(),
  body('livenessProof.challengeId').isMongoId(),
  body('livenessProof.action').isIn(['blink', 'turn']),
  body('livenessProof.durationMs').isInt({ min: 1000, max: 60000 }),
  body('livenessProof.observedFrames').isInt({ min: 3, max: 120 }),
];
const attendanceIdValidator = [
  param('id').isMongoId().withMessage('Attendance id must be a valid MongoDB id.'),
];
const attendanceListValidators = [
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['Present', 'Late', 'Absent', 'Leave']),
  query('department').optional().isString().trim().isLength({ max: 100 }),
  query('employeeId').optional().isString().trim().isLength({ max: 64 }),
];
const createAttendanceValidators = [
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('status').optional().isIn(['Present', 'Late', 'Absent', 'Leave']),
  body('recognitionMethod').optional().isIn(['Face Recognition', 'Manual']),
  body('confidence').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];
const updateAttendanceValidators = [
  ...attendanceIdValidator,
  body().isObject(),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('status').optional().isIn(['Present', 'Late', 'Absent', 'Leave']),
  body('recognitionMethod').optional().isIn(['Face Recognition', 'Manual']),
  body('confidence').optional({ values: 'null' }).isFloat({ min: 0, max: 1 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];
const dateParamValidator = [
  param('date').matches(/^\d{4}-\d{2}-\d{2}$/),
];
const employeeCodeValidator = [
  param('employeeId').isString().isLength({ min: 1, max: 64 }),
];

// Public — kiosk (no auth required)
router.get('/kiosk-status', getKioskStatus);
router.post('/liveness/challenge', issueLivenessChallenge);
router.post('/mark', attendanceScanRateLimit, faceScanBodyValidators, validateRequest, markAttendance);
router.post('/checkout', attendanceScanRateLimit, faceScanBodyValidators, validateRequest, checkOutAttendance);
router.post('/scan', attendanceScanRateLimit, faceScanBodyValidators, validateRequest, markAttendance);

router.use(protect);

router.get('/today', adminOrHR, getTodayAttendance);
router.get('/report', adminOrHR, reportValidators, validateRequest, getAttendanceReport);
router.get('/export', adminOrHR, reportValidators, validateRequest, exportAttendanceReport);
router.get('/dashboard',  adminOrHR,       getDashboard);
router.get('/analytics',  adminOrHR,       getAnalytics);
router.get('/my/stats',   employeeOrAdmin, getMyStats);
router.get('/my',         employeeOrAdmin, getMyAttendance);
router.get('/employee/:employeeId', employeeOrAdmin, employeeCodeValidator, validateRequest, getEmployeeAttendance);
router.get('/date/:date', adminOrHR, dateParamValidator, validateRequest, getDateAttendance);
router.get('/records', adminOrHR, attendanceListValidators, validateRequest, listAttendance);
router.get('/:id', adminOrHR, attendanceIdValidator, validateRequest, getAttendance);
router.get('/', adminOrHR, attendanceListValidators, validateRequest, getCompanyAttendance);
router.post('/', adminOnly, createAttendanceValidators, validateRequest, createAttendance);
router.put('/:id', adminOnly, updateAttendanceValidators, validateRequest, updateAttendance);
router.delete('/:id', adminOnly, attendanceIdValidator, validateRequest, deleteAttendance);

module.exports = router;
