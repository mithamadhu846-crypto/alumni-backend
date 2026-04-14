/**
 * Mentorship Controller — with persistent notifications
 */

const { Mentorship } = require('../models/Community');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

exports.requestMentorship = async (req, res) => {
  try {
    const { mentorId, areas, goals, message } = req.body;

    const mentor = await User.findById(mentorId);
    if (!mentor || !mentor.isMentor)
      return res.status(400).json({ error: 'Mentor not found or not available.' });
    if (mentor._id.toString() === req.user._id.toString())
      return res.status(400).json({ error: 'Cannot mentor yourself.' });

    const existing = await Mentorship.findOne({
      mentor: mentorId, mentee: req.user._id,
      status: { $in: ['pending', 'active'] },
    });
    if (existing) return res.status(400).json({ error: 'Mentorship request already exists.' });

    const mentorship = await Mentorship.create({
      mentor: mentorId, mentee: req.user._id, areas, goals, message,
    });

    // Persist notification to DB + emit socket
    await createNotification(req.io, {
      recipientId: mentorId,
      actorId: req.user._id,
      type: 'mentorship_request',
      title: 'New Mentorship Request',
      body: `${req.user.name} wants you to be their mentor${areas?.length ? ` in ${areas[0]}` : ''}.`,
      data: { mentorshipId: mentorship._id },
    });

    res.status(201).json({ message: 'Mentorship request sent.', mentorship });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not send request.' });
  }
};

exports.getMentorships = async (req, res) => {
  try {
    const { status, role } = req.query;
    let query = {};
    if (role === 'mentor') query.mentor = req.user._id;
    else if (role === 'mentee') query.mentee = req.user._id;
    else query.$or = [{ mentor: req.user._id }, { mentee: req.user._id }];
    if (status) query.status = status;

    const mentorships = await Mentorship.find(query)
      .populate('mentor', 'name avatar currentRole currentCompany skills mentorRating')
      .populate('mentee', 'name avatar department targetRole skills')
      .sort({ createdAt: -1 });

    res.json({ mentorships });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch mentorships.' });
  }
};

exports.updateMentorshipStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const mentorship = await Mentorship.findById(req.params.id)
      .populate('mentor', 'name')
      .populate('mentee', 'name');

    if (!mentorship) return res.status(404).json({ error: 'Mentorship not found.' });

    const isMentor = mentorship.mentor._id.toString() === req.user._id.toString();
    const isMentee = mentorship.mentee._id.toString() === req.user._id.toString();
    if (!isMentor && !isMentee) return res.status(403).json({ error: 'Not authorized.' });

    mentorship.status = status;
    if (status === 'active') mentorship.startDate = new Date();
    if (status === 'completed') {
      mentorship.endDate = new Date();
      const mentor = await User.findById(mentorship.mentor._id);
      await mentor.addPoints(100, 'mentorship_completed');
      await User.findByIdAndUpdate(mentorship.mentor._id, {
        $inc: { 'contributions.menteesMentored': 1 },
      });
    }
    await mentorship.save();

    // Notify the OTHER party
    const notifyId = isMentor ? mentorship.mentee._id : mentorship.mentor._id;
    const actorName = isMentor ? mentorship.mentor.name : mentorship.mentee.name;

    const notifMap = {
      active: {
        type: 'mentorship_accepted',
        title: 'Mentorship Accepted!',
        body: `${actorName} accepted your mentorship request.`,
      },
      declined: {
        type: 'mentorship_declined',
        title: 'Mentorship Declined',
        body: `${actorName} declined your mentorship request.`,
      },
      completed: {
        type: 'mentorship_completed',
        title: 'Mentorship Completed',
        body: `Your mentorship with ${actorName} has been marked complete.`,
      },
    };

    if (notifMap[status]) {
      await createNotification(req.io, {
        recipientId: notifyId,
        actorId: req.user._id,
        ...notifMap[status],
        data: { mentorshipId: mentorship._id },
      });
    }

    res.json({ message: `Mentorship ${status}.`, mentorship });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update mentorship.' });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const mentorship = await Mentorship.findById(req.params.id);

    if (!mentorship || mentorship.mentee.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not authorized.' });
    if (mentorship.status !== 'completed')
      return res.status(400).json({ error: 'Can only review completed mentorships.' });

    mentorship.rating = rating;
    mentorship.review = review;
    await mentorship.save();

    const mentor = await User.findById(mentorship.mentor);
    mentor.mentorRating += rating;
    mentor.mentorRatingCount += 1;
    await mentor.save({ validateBeforeSave: false });

    res.json({ message: 'Review submitted.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not submit review.' });
  }
};
