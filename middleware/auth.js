/**
 * Authentication & Authorization Middleware
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Verify JWT Token ─────────────────────────────────────────────────────────

const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) {
      return res.status(401).json({ error: 'User not found. Token invalid.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// ─── Role-Based Access Control ────────────────────────────────────────────────

/**
 * Restrict access to specific roles
 * Usage: authorize('admin', 'faculty')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

// ─── Optional Auth (doesn't fail if no token) ─────────────────────────────────

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch {
    // Silently fail - user just won't be authenticated
    next();
  }
};

module.exports = { protect, authorize, optionalAuth };
