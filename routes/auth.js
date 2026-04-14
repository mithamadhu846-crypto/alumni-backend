/**
 * Auth Routes
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register, login, firebaseAuth, refreshToken, getMe, updatePassword, logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('role').optional().isIn(['student', 'alumni', 'faculty', 'admin']),
], register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], login);

router.post('/firebase', firebaseAuth);
router.post('/refresh', refreshToken);
router.get('/me', protect, getMe);
router.put('/password', protect, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], updatePassword);
router.post('/logout', protect, logout);

module.exports = router;
