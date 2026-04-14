/**
 * Leaderboard Controller
 */
const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  try {
    const { role, department, period } = req.query;
    const query = { isActive: true };
    if (role && role !== 'all') query.role = role;
    if (department) query.department = department;

    const users = await User.find(query)
      .select('name avatar role department points badges contributions currentCompany currentRole graduationYear')
      .sort({ points: -1 })
      .limit(50);

    const ranked = users.map((u, i) => ({
      rank: i + 1,
      user: u,
      points: u.points,
      badgeCount: u.badges.length,
    }));

    res.json({ leaderboard: ranked });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch leaderboard.' });
  }
};

module.exports.leaderboardController = exports;
