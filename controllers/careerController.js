/**
 * Career Controller - Smart Roadmap Generator (FINAL FIX)
 */
const User = require('../models/User');

// Predefined career roadmaps
const CAREER_ROADMAPS = {
  'software engineer': {
    keywords: ['software', 'developer', 'frontend', 'backend', 'fullstack', 'web'],
    milestones: [
      { level: 1, title: 'Junior Developer', skills: ['HTML/CSS', 'JavaScript', 'Git', 'React'], timeframe: '0-1 year' },
      { level: 2, title: 'Mid Developer', skills: ['Node.js', 'APIs', 'Database', 'Testing'], timeframe: '1-3 years' },
      { level: 3, title: 'Senior Developer', skills: ['System Design', 'DevOps', 'Architecture'], timeframe: '3-6 years' },
      { level: 4, title: 'Lead Engineer', skills: ['Leadership', 'Cloud', 'Scaling'], timeframe: '6-9 years' },
    ],
  },

  'data scientist': {
    keywords: ['data', 'ai', 'ml', 'machine learning', 'analyst'],
    milestones: [
      { level: 1, title: 'Data Analyst', skills: ['Python', 'SQL', 'Excel'], timeframe: '0-1 year' },
      { level: 2, title: 'Junior Data Scientist', skills: ['ML', 'Pandas', 'Visualization'], timeframe: '1-3 years' },
      { level: 3, title: 'Senior Data Scientist', skills: ['Deep Learning', 'MLOps'], timeframe: '3-6 years' },
      { level: 4, title: 'Lead Data Scientist', skills: ['Strategy', 'Leadership'], timeframe: '6+ years' },
    ],
  },

  'product manager': {
    keywords: ['product', 'manager', 'pm'],
    milestones: [
      { level: 1, title: 'Associate PM', skills: ['Wireframing', 'Research'], timeframe: '0-2 years' },
      { level: 2, title: 'Product Manager', skills: ['Roadmap', 'Analytics'], timeframe: '2-5 years' },
      { level: 3, title: 'Senior PM', skills: ['Strategy', 'Leadership'], timeframe: '5-8 years' },
    ],
  },
};

// 🔥 SMART ROLE MATCHING FUNCTION
const findBestRoadmap = (role) => {
  role = role.toLowerCase();

  for (const key in CAREER_ROADMAPS) {
    const { keywords } = CAREER_ROADMAPS[key];

    for (const word of keywords) {
      if (role.includes(word)) {
        return CAREER_ROADMAPS[key];
      }
    }
  }

  return null;
};

exports.getCareerRoadmap = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const role = (req.query.targetRole || user.targetRole || '').toLowerCase();

    // 🔥 SMART MATCH
    let roadmap = findBestRoadmap(role);

    // ❌ fallback (only if nothing matches)
    if (!roadmap) {
      roadmap = {
        milestones: [
          { level: 1, title: 'Entry Level', skills: ['Basics', 'Communication'], timeframe: '0-2 years' },
          { level: 2, title: 'Mid Level', skills: ['Experience', 'Projects'], timeframe: '2-5 years' },
          { level: 3, title: 'Senior Level', skills: ['Leadership'], timeframe: '5+ years' },
        ],
      };
    }

    const userSkillCount = user.skills?.length || 0;

    const currentLevel = Math.min(
      roadmap.milestones.length,
      Math.max(1, Math.floor(userSkillCount / 2))
    );

    res.json({
      targetRole: role || 'Not set',
      roadmap,
      currentLevel,
      userSkills: user.skills || [],
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
};