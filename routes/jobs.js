// ─── jobs.js ──────────────────────────────────────────────────────────────────
const express = require('express');
const jobRouter = express.Router();
const { createJob, getJobs, getJob, applyJob, deleteJob } = require('../controllers/jobController');
const { protect, authorize } = require('../middleware/auth');

jobRouter.get('/', protect, getJobs);
jobRouter.post('/', protect, authorize('alumni', 'faculty', 'admin'), createJob);
jobRouter.get('/:id', protect, getJob);
jobRouter.post('/:id/apply', protect, applyJob);
jobRouter.delete('/:id', protect, deleteJob);

module.exports = jobRouter;
