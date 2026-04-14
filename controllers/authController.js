/**
 * Auth Controller
 * Handles registration, login, token refresh, and profile
 */

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// ─── Token Helpers ─────────────────────────────────────────────────────────────

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );

  return { accessToken, refreshToken };
};

// ─── Register ─────────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, department, graduationYear, enrollmentYear, uid } = req.body;

    // Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password, // Will be hashed by pre-save hook
      role: role || 'student',
      department,
      graduationYear,
      enrollmentYear,
      uid, // Firebase UID if using Firebase Auth
    });

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      message: 'Registration successful',
      token: accessToken,
      refreshToken,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
    }

    // Update login stats
    user.lastLogin = new Date();
    user.loginCount += 1;
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Login successful',
      token: accessToken,
      refreshToken,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ─── Firebase Login / Register ─────────────────────────────────────────────────

exports.firebaseAuth = async (req, res) => {
  try {
    const { uid, email, name, role, department, graduationYear } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: 'Firebase UID and email required.' });
    }

    // Find or create user
    let user = await User.findOne({ $or: [{ uid }, { email }] });

    if (!user) {
      user = await User.create({
        uid,
        email,
        name: name || email.split('@')[0],
        role: role || 'student',
        department,
        graduationYear,
        isVerified: true, // Firebase handles verification
      });
    } else if (!user.uid) {
      user.uid = uid;
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Firebase authentication successful',
      token: accessToken,
      refreshToken,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Firebase auth error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
    );

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user: user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
};

// ─── Update Password ──────────────────────────────────────────────────────────

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not update password.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed.' });
  }
};
