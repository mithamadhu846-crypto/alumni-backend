// ─── Startup Controller ───────────────────────────────────────────────────────
// controllers/startupController.js (inline here for conciseness)
const { Startup } = require('../models/Community');
const User = require('../models/User');

const createStartup = async (req, res) => {
  try {
    const startup = await Startup.create({
      ...req.body,
      founders: [req.user._id],
    });
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'contributions.startupsListed': 1 } });
    await req.user.addPoints(75, 'startup_listed');
    res.status(201).json({ message: 'Startup submitted for review.', startup });
  } catch (error) {
    res.status(500).json({ error: 'Could not create startup.' });
  }
};

const getStartups = async (req, res) => {
  try {
    const { sector, stage, hiring, page = 1, limit = 20 } = req.query;
    const query = { isApproved: true };
    if (sector) query.sector = sector;
    if (stage) query.stage = stage;
    if (hiring === 'true') query.isHiring = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const startups = await Startup.find(query)
      .populate('founders', 'name avatar role currentRole')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Startup.countDocuments(query);
    res.json({ startups, pagination: { page: parseInt(page), total } });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch startups.' });
  }
};

const approveStartup = async (req, res) => {
  try {
    const startup = await Startup.findByIdAndUpdate(
      req.params.id, { isApproved: true }, { new: true }
    );
    if (!startup) return res.status(404).json({ error: 'Startup not found.' });
    res.json({ message: 'Startup approved.', startup });
  } catch (error) {
    res.status(500).json({ error: 'Could not approve startup.' });
  }
};

const likeStartup = async (req, res) => {
  try {
    const startup = await Startup.findById(req.params.id);
    if (!startup) return res.status(404).json({ error: 'Not found.' });
    const liked = startup.likes.includes(req.user._id);
    if (liked) {
      startup.likes.pull(req.user._id);
    } else {
      startup.likes.push(req.user._id);
    }
    await startup.save();
    res.json({ liked: !liked, likeCount: startup.likes.length });
  } catch (error) {
    res.status(500).json({ error: 'Could not like startup.' });
  }
};

// ─── Router ───────────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getStartups);
router.post('/', protect, createStartup);
router.patch('/:id/approve', protect, authorize('admin'), approveStartup);
router.post('/:id/like', protect, likeStartup);

module.exports = router;
