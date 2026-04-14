const express = require('express');
const router = express.Router();
const {
  getAllUsers, getUserProfile, updateProfile, getAlumniMatches,
  getAlumniDirectory, getSkillGapAnalysis, toggleUserStatus, changeUserRole, updateTargetRole,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), getAllUsers);
router.get('/alumni', protect, getAlumniDirectory);
router.get('/matches', protect, authorize('student'), getAlumniMatches);
router.get('/skill-gap', protect, getSkillGapAnalysis);
router.get('/:id', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.patch('/:id/toggle', protect, authorize('admin'), toggleUserStatus);
router.patch('/:id/role', protect, authorize('admin'), changeUserRole);

module.exports = router;
