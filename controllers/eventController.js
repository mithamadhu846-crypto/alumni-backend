/**
 * Events Controller — with notifications
 */

const { Event } = require('../models/Community');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, organizer: req.user._id });
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'contributions.eventsHosted': 1 } });

    // Broadcast to notice board room
    req.io.to('notice_board').emit('newEvent', { event, postedBy: req.user.name });

    res.status(201).json({ message: 'Event created. Pending admin approval.', event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not create event.' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { category, upcoming, page = 1, limit = 20 } = req.query;
    const query = {};
    if (category) query.category = category;
    if (upcoming === 'true') query.date = { $gte: new Date() };
    if (req.user.role !== 'admin') query.isApproved = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const events = await Event.find(query)
      .populate('organizer', 'name avatar role')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);
    res.json({ events, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch events.' });
  }
};

exports.registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name');
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (event.registrations.includes(req.user._id))
      return res.status(400).json({ error: 'Already registered.' });
    if (event.maxAttendees && event.registrations.length >= event.maxAttendees)
      return res.status(400).json({ error: 'Event is full.' });

    event.registrations.push(req.user._id);
    await event.save();
    await req.user.addPoints(10, 'event_registration');

    // Notify the organizer
    if (event.organizer._id.toString() !== req.user._id.toString()) {
      await createNotification(req.io, {
        recipientId: event.organizer._id,
        actorId: req.user._id,
        type: 'event_approved', // reuse type for registration
        title: 'Event Registration',
        body: `${req.user.name} registered for "${event.title}".`,
        data: { eventId: event._id },
      });
    }

    res.json({ message: 'Registered for event.' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed.' });
  }
};

exports.approveEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id, { isApproved: true }, { new: true }
    ).populate('organizer', 'name');

    if (!event) return res.status(404).json({ error: 'Event not found.' });

    req.io.to('notice_board').emit('eventApproved', { event });

    // Notify organizer
    await createNotification(req.io, {
      recipientId: event.organizer._id,
      actorId: req.user._id,
      type: 'event_approved',
      title: 'Event Approved!',
      body: `Your event "${event.title}" has been approved and is now live.`,
      data: { eventId: event._id },
    });

    res.json({ message: 'Event approved.', event });
  } catch (error) {
    res.status(500).json({ error: 'Could not approve event.' });
  }
};
