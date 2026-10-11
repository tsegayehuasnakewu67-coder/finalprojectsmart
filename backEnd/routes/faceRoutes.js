const router = require('express').Router();
const { registerFace } = require('../controllers/faceController');
const { previewBulkFaces } = require('../controllers/faceBulkPreviewController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { parseBulkFaceUpload } = require('../middleware/bulkFaceUpload');
const { bulkFaceRateLimit } = require('../middleware/apiSecurity');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/requestValidation');

router.post('/bulk-preview', protect, adminOnly, parseBulkFaceUpload, previewBulkFaces);
const registrationValidators = [
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }),
  body('faceDescriptor').isArray({ min: 128, max: 128 }),
  body('faceDescriptor.*').isFloat({ min: -2, max: 2 }),
];
router.post('/bulk-register', protect, adminOnly, bulkFaceRateLimit, registrationValidators, validateRequest, registerFace);
router.post('/register', protect, adminOnly, registrationValidators, validateRequest, registerFace);

module.exports = router;
