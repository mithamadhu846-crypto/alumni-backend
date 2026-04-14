/**
 * User Model
 * Supports 4-tier RBAC: student, alumni, faculty, admin
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ─── Core Identity ──────────────────────────────────────────────────────────
  uid: { type: String, unique: true, sparse: true }, // Firebase UID
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 }, // Optional if using Firebase Auth only
  role: {
    type: String,
    enum: ['student', 'alumni', 'faculty', 'admin'],
    required: true,
    default: 'student',
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  avatar: { type: String, default: '' },

  // ─── Profile Details ─────────────────────────────────────────────────────────
  department: { type: String, trim: true },
  graduationYear: { type: Number },
  enrollmentYear: { type: Number },
  rollNumber: { type: String, sparse: true },
  phone: { type: String },
  bio: { type: String, maxlength: 500 },
  location: { type: String },

  // ─── Professional (Alumni/Faculty) ───────────────────────────────────────────
  currentCompany: { type: String },
  currentRole: { type: String },
  industry: { type: String },
  linkedIn: { type: String },
  github: { type: String },
  portfolio: { type: String },

  // ─── Skills ──────────────────────────────────────────────────────────────────
  skills: [{ type: String }],
  skillScores: [{
    skill: String,
    score: Number, // 0-100
    assessedAt: { type: Date, default: Date.now },
  }],

  // ─── Mentorship ──────────────────────────────────────────────────────────────
  isMentor: { type: Boolean, default: false },
  mentorshipAreas: [{ type: String }],
  menteeCount: { type: Number, default: 0 },
  mentorRating: { type: Number, default: 0, min: 0, max: 5 },
  mentorRatingCount: { type: Number, default: 0 },

  // ─── Leaderboard / Gamification ───────────────────────────────────────────────
  points: { type: Number, default: 0 },
  badges: [{
    name: String,
    description: String,
    icon: String,
    earnedAt: { type: Date, default: Date.now },
  }],
  contributions: {
    jobsPosted: { type: Number, default: 0 },
    eventsHosted: { type: Number, default: 0 },
    menteesMentored: { type: Number, default: 0 },
    startupsListed: { type: Number, default: 0 },
  },

  // ─── Career ──────────────────────────────────────────────────────────────────
  targetRole: { type: String },
  careerPath: [{ type: String }], // Array of role milestones
  interests: [{ type: String }],

  // ─── Meta ────────────────────────────────────────────────────────────────────
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  fcmToken: { type: String }, // Push notification token
  refreshToken: { type: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ graduationYear: 1 });
userSchema.index({ skills: 1 });
userSchema.index({ points: -1 }); // For leaderboard sorting
userSchema.index({ name: 'text', bio: 'text', skills: 'text' }); // Full-text search

// ─── Virtual Fields ───────────────────────────────────────────────────────────

userSchema.virtual('mentorRatingAvg').get(function () {
  if (this.mentorRatingCount === 0) return 0;
  return (this.mentorRating / this.mentorRatingCount).toFixed(1);
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────

userSchema.pre('save', async function (next) {
  // Hash password only if modified
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.fcmToken;
  return obj;
};

// Award points and check for new badges
userSchema.methods.addPoints = async function (amount, reason) {
  this.points += amount;

  // Badge thresholds
  const badgeThresholds = [
    { points: 100, name: 'Rising Star', icon: '⭐', description: 'Earned 100 points' },
    { points: 500, name: 'Community Builder', icon: '🏗️', description: 'Earned 500 points' },
    { points: 1000, name: 'Alumni Champion', icon: '🏆', description: 'Earned 1000 points' },
    { points: 5000, name: 'Legend', icon: '👑', description: 'Earned 5000 points' },
  ];

  for (const threshold of badgeThresholds) {
    const alreadyHas = this.badges.some(b => b.name === threshold.name);
    if (this.points >= threshold.points && !alreadyHas) {
      this.badges.push({
        name: threshold.name,
        description: threshold.description,
        icon: threshold.icon,
      });
    }
  }

  await this.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;
