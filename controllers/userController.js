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
    const { targetRole } = req.query;
    const currentUser = await User.findById(req.user._id);
    const role = targetRole || currentUser?.targetRole || '';

    if (!role) {
      return res.json({ matchPercentage: 0, gaps: [], strengths: [], targetRole: '' });
    }

    const userSkills = (currentUser.skills || []).map(s => s.toLowerCase().trim());

    // Role-based required skills
    const roleLower = role.toLowerCase();
    let requiredSkills = [];

    try {
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a career advisor API. Respond with JSON only.' },
          { role: 'user', content: `List the top 15 most important technical and soft skills required for a "${role}" role. Return JSON: { "skills": ["skill1", "skill2", ...] }` },
        ],
      });
      const raw = completion.choices[0].message.content.trim();
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        requiredSkills = (parsed.skills || []).map(s => s.toLowerCase().trim());
      }
    } catch (e) {
      console.log('Groq fallback for skill gap:', e.message);
    }

    // Fallback if Groq fails
    if (requiredSkills.length === 0) {
      if (roleLower.includes('software') || roleLower.includes('developer') || roleLower.includes('engineer')) {
        requiredSkills = ['javascript', 'python', 'react', 'node.js', 'sql', 'git', 'rest apis', 'docker', 'aws', 'system design', 'data structures', 'algorithms', 'agile', 'communication', 'problem solving'];
      } else if (roleLower.includes('data') || roleLower.includes('analyst') || roleLower.includes('scientist')) {
        requiredSkills = ['python', 'sql', 'machine learning', 'data visualization', 'statistics', 'excel', 'tableau', 'pandas', 'numpy', 'tensorflow', 'communication', 'critical thinking', 'r', 'power bi', 'hadoop'];
      } else if (roleLower.includes('hr') || roleLower.includes('human resource')) {
        requiredSkills = ['recruitment', 'talent acquisition', 'employee relations', 'hr policies', 'payroll', 'performance management', 'onboarding', 'communication', 'conflict resolution', 'ms office', 'labor laws', 'training', 'leadership', 'organizational skills', 'empathy'];
      } else if (roleLower.includes('design') || roleLower.includes('ui') || roleLower.includes('ux')) {
        requiredSkills = ['figma', 'adobe xd', 'sketch', 'user research', 'wireframing', 'prototyping', 'html', 'css', 'typography', 'color theory', 'usability testing', 'communication', 'creativity', 'photoshop', 'illustrator'];
      } else if (roleLower.includes('market')) {
        requiredSkills = ['seo', 'social media', 'content marketing', 'google analytics', 'email marketing', 'copywriting', 'brand strategy', 'market research', 'ppc', 'crm', 'communication', 'creativity', 'data analysis', 'excel', 'canva'];
      } else {
        requiredSkills = ['communication', 'leadership', 'problem solving', 'teamwork', 'time management', 'critical thinking', 'ms office', 'project management', 'adaptability', 'presentation skills', 'data analysis', 'customer service', 'negotiation', 'planning', 'decision making'];
      }
    }

    const gaps = requiredSkills
      .filter(sk => !userSkills.some(us => us.includes(sk) || sk.includes(us)))
      .map((skill, i) => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        frequency: Math.max(1, 15 - i),
        total: 15,
        priority: i < 5 ? 'High' : i < 10 ? 'Medium' : 'Low',
      }));

    const strengths = requiredSkills
      .filter(sk => userSkills.some(us => us.includes(sk) || sk.includes(us)))
      .map(skill => ({
        skill: skill.charAt(0).toUpperCase() + skill.slice(1),
        frequency: 10,
        total: 15,
      }));

    const matchPercentage = requiredSkills.length > 0
      ? Math.round((strengths.length / requiredSkills.length) * 100)
      : 0;

    return res.json({ matchPercentage, gaps, strengths, targetRole: role });
  } catch (error) {
    console.error('getSkillGapAnalysis error:', error.message);
    res.status(500).json({ error: 'Could not analyze skill gap.' });
  }
};
