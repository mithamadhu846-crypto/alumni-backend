/**
 * Users Controller
 * Profile management + Alumni Matching Algorithm
 */

const User = require('../models/User');

// ─── Get All Users (Admin) ────────────────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  try {
    const { role, department, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (department) query.department = department;
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch users.' });
  }
};

// ─── Get User Profile ─────────────────────────────────────────────────────────

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────

exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'bio', 'phone', 'location', 'department', 'graduationYear',
      'currentCompany', 'currentRole', 'industry', 'linkedIn', 'github',
      'portfolio', 'skills', 'isMentor', 'mentorshipAreas', 'targetRole',
      'interests', 'avatar',
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    res.json({ message: 'Profile updated successfully.', user });
  } catch (error) {
    res.status(500).json({ error: 'Could not update profile.' });
  }
};

// ─── Alumni Matching Algorithm ────────────────────────────────────────────────

/**
 * Computes a match score (0-100) between a student and an alumni
 * based on shared skills, department, industry, career interests
 */
const computeMatchScore = (student, alumni) => {
  let score = 0;
  const breakdown = {};

  // 1. Shared Skills (max 40 points)
  const studentSkills = new Set(student.skills.map(s => s.toLowerCase()));
  const alumniSkills = new Set(alumni.skills.map(s => s.toLowerCase()));
  const sharedSkills = [...studentSkills].filter(s => alumniSkills.has(s));
  const skillScore = Math.min(40, (sharedSkills.length / Math.max(1, studentSkills.size)) * 40);
  score += skillScore;
  breakdown.skills = { score: Math.round(skillScore), shared: sharedSkills };

  // 2. Department Match (max 25 points)
  if (student.department && alumni.department &&
      student.department.toLowerCase() === alumni.department.toLowerCase()) {
    score += 25;
    breakdown.department = { score: 25, match: true };
  } else {
    breakdown.department = { score: 0, match: false };
  }

  // 3. Career Alignment (max 20 points)
  // Check if alumni's current role matches student's target role
  let careerScore = 0;
  if (student.targetRole && alumni.currentRole) {
    const targetLower = student.targetRole.toLowerCase();
    const currentLower = alumni.currentRole.toLowerCase();
    if (targetLower === currentLower) {
      careerScore = 20;
    } else if (targetLower.includes(currentLower) || currentLower.includes(targetLower)) {
      careerScore = 12;
    }
  }
  // Check career path overlap
  if (student.interests && alumni.mentorshipAreas) {
    const studentInterestsSet = new Set(student.interests.map(i => i.toLowerCase()));
    const mentorAreasSet = new Set(alumni.mentorshipAreas.map(a => a.toLowerCase()));
    const interestOverlap = [...studentInterestsSet].filter(i => mentorAreasSet.has(i));
    careerScore = Math.min(20, careerScore + interestOverlap.length * 4);
  }
  score += careerScore;
  breakdown.career = { score: careerScore };

  // 4. Mentor Rating Bonus (max 10 points)
  const ratingScore = alumni.mentorRatingCount > 0
    ? Math.min(10, (parseFloat(alumni.mentorRatingAvg) / 5) * 10)
    : 0;
  score += ratingScore;
  breakdown.rating = { score: Math.round(ratingScore), rating: alumni.mentorRatingAvg };

  // 5. Activity Bonus (max 5 points)
  const activityScore = alumni.lastLogin
    ? Math.max(0, 5 - Math.floor((Date.now() - new Date(alumni.lastLogin)) / (1000 * 60 * 60 * 24 * 7)))
    : 0;
  score += activityScore;
  breakdown.activity = { score: activityScore };

  return {
    score: Math.round(Math.min(100, score)),
    breakdown,
    sharedSkills,
  };
};

exports.getAlumniMatches = async (req, res) => {
  try {
    const student = await User.findById(req.user._id);

    if (student.role !== 'student') {
      return res.status(400).json({ error: 'Matching is only available for students.' });
    }

    // Fetch all active alumni who are available as mentors
    const alumni = await User.find({
      role: 'alumni',
      isActive: true,
      isMentor: true,
    }).select('-password -refreshToken');

    // Compute match scores
    const matches = alumni
      .map(alum => ({
        alumni: alum.toPublicJSON(),
        ...computeMatchScore(student, alum),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 matches

    res.json({ matches, totalAlumni: alumni.length });
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Could not compute matches.' });
  }
};

// ─── Get Alumni Directory ─────────────────────────────────────────────────────

exports.getAlumniDirectory = async (req, res) => {
  try {
    const { department, industry, skills, page = 1, limit = 20, search } = req.query;

    const query = { role: 'alumni', isActive: true };
    if (department) query.department = department;
    if (industry) query.industry = industry;
    if (skills) query.skills = { $in: skills.split(',') };
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const alumni = await User.find(query)
      .select('-password -refreshToken -fcmToken')
      .sort({ points: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      alumni,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch alumni directory.' });
  }
};

// ─── Skill Gap Analysis ───────────────────────────────────────────────────────

exports.getSkillGapAnalysis = async (req, res) => {
  try {
    const student = await User.findById(req.user._id);
    const { targetRole } = req.query;

    const role = targetRole || student.targetRole;
    if (!role) {
      return res.status(400).json({ error: 'Target role required for skill gap analysis.' });
    }

    // Find alumni in target role and extract their skills
    const roleAlumni = await User.find({
      role: 'alumni',
      currentRole: { $regex: role, $options: 'i' },
      isActive: true,
    }).select('skills');

    // Count skill frequency
    const skillFrequency = {};
    roleAlumni.forEach(alum => {
      alum.skills.forEach(skill => {
        const s = skill.toLowerCase();
        skillFrequency[s] = (skillFrequency[s] || 0) + 1;
      });
    });

    // Sort by frequency
    const requiredSkills = Object.entries(skillFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([skill, count]) => ({ skill, frequency: count, total: roleAlumni.length }));

    // Identify gaps
    const studentSkillSet = new Set(student.skills.map(s => s.toLowerCase()));
    const gaps = requiredSkills.filter(s => !studentSkillSet.has(s.skill));
    const strengths = requiredSkills.filter(s => studentSkillSet.has(s.skill));

    res.json({
      targetRole: role,
      requiredSkills,
      gaps: gaps.slice(0, 8),
      strengths,
      matchPercentage: Math.round((strengths.length / Math.max(1, requiredSkills.length)) * 100),
      basedOnAlumniCount: roleAlumni.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Skill gap analysis failed.' });
  }
};

// ─── Admin: Toggle User Status ────────────────────────────────────────────────

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, user });
  } catch (error) {
    res.status(500).json({ error: 'Could not update user status.' });
  }
};

// ─── Admin: Change User Role ──────────────────────────────────────────────────

exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['student', 'alumni', 'faculty', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'Role updated.', user });
  } catch (error) {
    res.status(500).json({ error: 'Could not change role.' });
  }
};
