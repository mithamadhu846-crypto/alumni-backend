/**
 * Jobs Controller — with notifications
 */

const Job = require('../models/Job');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

exports.createJob = async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, postedBy: req.user._id });
    await req.user.addPoints(50, 'job_posted');
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'contributions.jobsPosted': 1 } });

    // Notify all students via socket broadcast (no DB notif for every user — just broadcast)
    req.io.to('role_student').emit('newJob', {
      jobId: job._id,
      title: job.title,
      company: job.company,
      type: job.type,
      postedBy: req.user.name,
    });

    res.status(201).json({ message: 'Job posted successfully.', job });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create job.' });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { type, department, skills, search, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (type) query.type = type;
    if (department) query.department = department;
    if (skills) query.skills = { $in: skills.split(',') };
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const jobs = await Job.find(query)
      .populate('postedBy', 'name avatar role currentCompany')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);
    res.json({ jobs, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch jobs.' });
  }
};

exports.getJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id, { $inc: { views: 1 } }, { new: true }
    ).populate('postedBy', 'name avatar role currentCompany');
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch job.' });
  }
};

exports.applyJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name');
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (job.applications.includes(req.user._id))
      return res.status(400).json({ error: 'Already applied.' });

    job.applications.push(req.user._id);
    await job.save();

    // Notify job poster
    await createNotification(req.io, {
      recipientId: job.postedBy._id,
      actorId: req.user._id,
      type: 'application_received',
      title: 'New Job Application',
      body: `${req.user.name} applied for "${job.title}".`,
      data: { jobId: job._id },
    });

    res.json({ message: 'Application submitted.' });
  } catch (error) {
    res.status(500).json({ error: 'Application failed.' });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const isOwner = job.postedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not authorized.' });
    await job.deleteOne();
    res.json({ message: 'Job deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete job.' });
  }
};
