const { body, param, query } = require('express-validator');

const employeeIdParam = [
  param('id').isMongoId().withMessage('Employee id must be a valid MongoDB id.'),
];

const listEmployeesQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer.'),
  query('department').optional().isString().trim().isLength({ max: 100 }).withMessage('Department must be 100 characters or fewer.'),
  query('status').optional().isIn(['Active', 'Inactive', 'On Leave']).withMessage('Invalid employee status.'),
];

const createEmployeeBody = [
  body('employeeId').isString().trim().notEmpty().isLength({ max: 64 }).withMessage('Employee ID is required and must be 64 characters or fewer.'),
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('fullName').optional().isString().trim().isLength({ min: 1, max: 201 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 201 }),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Department is required.'),
  body('position').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Position is required.'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required to create an employee login.'),
  body('phone').optional().isString().trim().isLength({ max: 32 }),
  body('gender').optional().isString().trim().isLength({ max: 40 }),
  body('address').optional().isString().trim().isLength({ max: 300 }),
  body('photo').optional().isString().trim().isLength({ max: 500 }),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601({ strict: true }),
  body('faceEncoding').optional().isArray({ max: 128 }),
  body('faceEncoding.*').optional().isFloat({ min: -2, max: 2 }),
  body('status').optional().isIn(['Active', 'Inactive', 'On Leave']),
];

const updateEmployeeBody = [
  body().isObject().withMessage('A JSON object is required.'),
  body('employeeId').optional().isString().trim().notEmpty().isLength({ max: 64 }),
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('department').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('position').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('role').optional().isIn(['admin', 'hr', 'employee']),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 32 }),
  body('gender').optional().isString().trim().isLength({ max: 40 }),
  body('address').optional().isString().trim().isLength({ max: 300 }),
  body('photo').optional().isString().trim().isLength({ max: 500 }),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601({ strict: true }),
  body('status').optional().isIn(['Active', 'Inactive', 'On Leave']),
];

module.exports = { employeeIdParam, listEmployeesQuery, createEmployeeBody, updateEmployeeBody };
