/**
 * Analytics Controller - Admin Dashboard
 */

const User = require('../models/User');
const Job = require('../models/Job');
const { Event, Mentorship, Notice, Startup } = require('../models/Community');

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      studentCount,
      alumniCount,
      facultyCount,
      totalJobs,
      activeJobs,
      totalEvents,
      upcomingEvents,
      totalMentorships,
      activeMentorships,
      totalStartups,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'alumni', isActive: true }),
      User.countDocuments({ role: 'faculty', isActive: true }),
      Job.countDocuments(),
      Job.countDocuments({ isActive: true }),
      Event.countDocuments(),
      Event.countDocuments({ date: { $gte: new Date() }, isApproved: true }),
      Mentorship.countDocuments(),
      Mentorship.countDocuments({ status: 'active' }),
      Startup.countDocuments({ isApproved: true }),
    ]);

    // New users per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            role: '$role',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Top departments
    const topDepartments = await User.aggregate([
      { $match: { department: { $exists: true, $ne: '' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Skills in demand (from jobs)
    const topSkills = await Job.aggregate([
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Recent signups
    const recentUsers = await User.find({ isActive: true })
      .select('name email role department createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      overview: {
        totalUsers,
        studentCount,
        alumniCount,
        facultyCount,
        totalJobs,
        activeJobs,
        totalEvents,
        upcomingEvents,
        totalMentorships,
        activeMentorships,
        totalStartups,
      },
      userGrowth,
      topDepartments,
      topSkills,
      recentUsers,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Could not fetch analytics.' });
  }
};

exports.getEngagementStats = async (req, res) => {
  try {
    // Most active users
    const topContributors = await User.find({ isActive: true })
      .select('name avatar role points badges contributions')
      .sort({ points: -1 })
      .limit(10);

    // Mentorship conversion rate
    const mentorshipStats = await Mentorship.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Job application stats
    const jobStats = await Job.aggregate([
      {
        $project: {
          title: 1,
          type: 1,
          applicationCount: { $size: '$applications' },
          views: 1,
        },
      },
      { $sort: { applicationCount: -1 } },
      { $limit: 10 },
    ]);

    res.json({ topContributors, mentorshipStats, jobStats });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch engagement stats.' });
  }
};
