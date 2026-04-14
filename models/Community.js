/**
 * Event Model
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['workshop', 'seminar', 'networking', 'hackathon', 'webinar', 'reunion', 'other'],
    required: true,
  },
  date: { type: Date, required: true },
  endDate: { type: Date },
  venue: { type: String },
  isOnline: { type: Boolean, default: false },
  meetLink: { type: String },
  banner: { type: String },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registrations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  maxAttendees: { type: Number },
  isApproved: { type: Boolean, default: false },
  targetRoles: [{ type: String, enum: ['student', 'alumni', 'faculty', 'admin', 'all'] }],
  tags: [{ type: String }],
  registrationDeadline: { type: Date },
}, { timestamps: true });

eventSchema.index({ date: 1, isApproved: 1 });

const Event = mongoose.model('Event', eventSchema);

// ─── Notice Model ─────────────────────────────────────────────────────────────

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  targetRoles: [{ type: String, enum: ['student', 'alumni', 'faculty', 'admin', 'all'] }],
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  attachments: [{ name: String, url: String }],
  reads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const Notice = mongoose.model('Notice', noticeSchema);

// ─── Mentorship Model ─────────────────────────────────────────────────────────

const mentorshipSchema = new mongoose.Schema({
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mentee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'declined', 'cancelled'],
    default: 'pending',
  },
  areas: [{ type: String }], // What topics the mentorship covers
  goals: { type: String },
  message: { type: String }, // Initial request message
  startDate: { type: Date },
  endDate: { type: Date },
  sessions: [{
    date: Date,
    notes: String,
    duration: Number, // minutes
  }],
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  matchScore: { type: Number }, // Algorithm match score 0-100
}, { timestamps: true });

mentorshipSchema.index({ mentor: 1, status: 1 });
mentorshipSchema.index({ mentee: 1, status: 1 });

const Mentorship = mongoose.model('Mentorship', mentorshipSchema);

// ─── Startup Model ────────────────────────────────────────────────────────────

const startupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tagline: { type: String },
  description: { type: String, required: true },
  logo: { type: String },
  website: { type: String },
  sector: { type: String },
  stage: {
    type: String,
    enum: ['idea', 'mvp', 'early-stage', 'growth', 'scaling', 'acquired'],
    default: 'idea',
  },
  foundedYear: { type: Number },
  founders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  teamSize: { type: Number },
  isHiring: { type: Boolean, default: false },
  jobOpenings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
  socialLinks: {
    linkedin: String,
    twitter: String,
    github: String,
  },
  isApproved: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const Startup = mongoose.model('Startup', startupSchema);

module.exports = { Event, Notice, Mentorship, Startup };
