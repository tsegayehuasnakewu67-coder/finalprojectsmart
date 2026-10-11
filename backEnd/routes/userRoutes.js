const router = require('express').Router();
const {
  getAllUsers, getUserById, updateUser, deleteUser, updateFace, getDepartments,
} = require('../controllers/userController');
const { adminResetPassword } = require('../controllers/authController');
const { protect, adminOnly, adminOrHR, employeeOrAdmin } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',                adminOrHR,        getAllUsers);
router.get('/departments',     adminOrHR,        getDepartments);
router.get('/:id',             employeeOrAdmin, getUserById);
router.put('/:id',             adminOnly,       updateUser);
router.post('/:id/reset-password', adminOnly,    adminResetPassword);
router.delete('/:id',          adminOnly,       deleteUser);
router.patch('/:id/face',      adminOnly,       updateFace);

module.exports = router;
