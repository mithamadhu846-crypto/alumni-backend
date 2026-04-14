/**
 * Notice Board Controller
 */
const { Notice } = require('../models/Community');
const { createNotification } = require('./notificationController');

exports.createNotice = async (req, res) => {
  try {
    const notice = await Notice.create({ ...req.body, postedBy: req.user._id });
    req.io.to('notice_board').emit('newNotice', { notice });
    res.status(201).json({ message: 'Notice posted.', notice });
  } catch (error) {
    res.status(500).json({ error: 'Could not create notice.' });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const { priority } = req.query;

    // Fixed: was using double $or key (second overwrote first)
    const query = {
      isActive: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }] },
        { $or: [{ targetRoles: req.user.role }, { targetRoles: 'all' }] },
      ],
    };
    if (priority) query.priority = priority;

    const notices = await Notice.find(query)
      .populate('postedBy', 'name role avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notices });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch notices.' });
  }
};

exports.markRead = async (req, res) => {
  try {
    await Notice.findByIdAndUpdate(req.params.id, {
      $addToSet: { reads: req.user._id },
    });
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not mark read.' });
  }
};
