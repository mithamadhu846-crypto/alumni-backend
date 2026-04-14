/**
 * Job Model - Alumni Job Portal
 */

const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, required: true },
  type: {
    type: String,
    enum: ['full-time', 'part-time', 'internship', 'contract', 'remote'],
    required: true,
  },
  description: { type: String, required: true },
  requirements: [{ type: String }],
  skills: [{ type: String }],
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'INR' },
    period: { type: String, default: 'yearly' },
  },
  applyUrl: { type: String },
  applyEmail: { type: String },
  deadline: { type: Date },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  views: { type: Number, default: 0 },
  applications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  department: { type: String }, // Targeted department
  targetYear: { type: Number }, // Target graduation year (for internships)
  tags: [{ type: String }],
}, { timestamps: true });

jobSchema.index({ title: 'text', company: 'text', description: 'text', skills: 'text' });
jobSchema.index({ type: 1, isActive: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
