/**
 * AI Chatbot Controller
 * Powered by OpenAI GPT → Smart keyword fallback
 */

const https = require('https');

const SYSTEM_PROMPT = `You are AlumniBot, an expert AI career advisor for AlumniConnect — a college alumni networking platform.

Your expertise:
- Career guidance, roadmaps, and progression planning
- Skill gap analysis and learning recommendations  
- Job/internship search strategies
- Mentorship advice and alumni networking
- Interview prep and resume tips
- Industry trends and in-demand skills

Platform features you guide users on:
- Jobs Portal: full-time, part-time, internship, remote jobs by alumni
- Events: workshops, seminars, hackathons, webinars, networking
- Mentorship: AI-matched alumni mentors by skills and goals
- Career Roadmap: step-by-step career progression
- Skill Gap Analysis: missing skills for target roles
- Alumni Directory: search by dept, skills, company
- Startup Hub: alumni-founded startups
- Leaderboard: points and badges for contributions
- Resume Analyzer: AI feedback on your resume

Be friendly, concise, and actionable. Use bullet points for lists. Max 150 words per response.`;

// ─── Helper: raw HTTPS POST ───────────────────────────────────────────────────
const httpsPost = (hostname, path, headers, body) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('JSON parse error')); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });

// ─── OpenAI ───────────────────────────────────────────────────────────────────
const callOpenAI = async (messages) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const openaiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const body = JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    max_tokens: 600,
    messages: openaiMessages,
  });

  const parsed = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body
  );

  if (parsed.error) throw new Error(parsed.error.message);
  return parsed.choices?.[0]?.message?.content || 'No response generated.';
};

// ─── Smart keyword fallback ───────────────────────────────────────────────────
const smartFallback = (msg) => {
  const m = msg.toLowerCase();
  if (m.includes('job') || m.includes('internship'))
    return "💼 Head to the **Jobs** tab to browse opportunities posted by alumni! Filter by type (full-time, internship, remote) and required skills.";
  if (m.includes('mentor'))
    return "👥 Find mentors in the **Alumni Directory** — look for the green 'Available for mentorship' tag. The app auto-matches you by skills and career goals!";
  if (m.includes('event') || m.includes('workshop') || m.includes('hackathon'))
    return "📅 Check the **Events** tab for upcoming workshops, hackathons, webinars, and networking sessions. Register directly from there!";
  if (m.includes('skill') || m.includes('gap') || m.includes('learn'))
    return "📊 The **Career → Skill Gap** section shows exactly which skills you're missing for your target role, based on real alumni data.";
  if (m.includes('career') || m.includes('roadmap') || m.includes('path'))
    return "🚀 Set your target role in your profile, then visit **Career** for a step-by-step personalized roadmap with milestones and resources!";
  if (m.includes('resume') || m.includes('cv'))
    return "📄 Use the **Resume Analyzer** in the Career section — paste your resume and get AI-powered feedback on skills, ATS score, and improvements!";
  if (m.includes('startup'))
    return "🚀 Explore the **Startup Hub** (More tab) to discover alumni-founded companies, support them, or apply to open positions!";
  if (m.includes('badge') || m.includes('point') || m.includes('leaderboard'))
    return "🏆 Earn points by posting jobs (+50), registering for events (+10), completing mentorships (+100), and more. Check the **Leaderboard** to see your rank!";
  return "Hi! I'm AlumniBot 🤖 I can help with:\n• 💼 Finding jobs & internships\n• 👥 Connecting with mentors\n• 🚀 Career roadmaps\n• 📊 Skill gap analysis\n• 📄 Resume tips\n\nWhat would you like to explore?";
};

// ─── Main Send Message ────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required.' });

    let responseText = null;
    let source = 'fallback';

    const conversationMessages = [
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message.trim() },
    ];

    // 1️⃣ Try OpenAI
    try {
      responseText = await callOpenAI(conversationMessages);
      source = 'openai';
    } catch (e) {
      console.warn('[Chatbot] OpenAI failed:', e.message);
    }

    // 2️⃣ Keyword fallback
    if (!responseText) {
      responseText = smartFallback(message);
      source = 'fallback';
    }

    res.json({ messages: [{ text: responseText }], source });
  } catch (error) {
    console.error('[Chatbot] Unhandled error:', error);
    res.json({ messages: [{ text: "I'm having trouble right now. Please try again! 🤖" }], source: 'error' });
  }
};

// ─── Resume Analyzer ──────────────────────────────────────────────────────────
exports.analyzeResume = async (req, res) => {
  try {
    const { resumeText, targetRole } = req.body;
    if (!resumeText?.trim()) return res.status(400).json({ error: 'Resume text required.' });

    const prompt = `Analyze this resume for the target role: "${targetRole || 'tech industry'}".

RESUME TEXT:
${resumeText.slice(0, 3000)}

Return ONLY valid JSON (no markdown fences):
{"score":85,"atsScore":78,"summary":"2 sentence overall assessment.","strengths":["strength1","strength2","strength3"],"improvements":["improvement1","improvement2","improvement3"],"missingSkills":["skill1","skill2"],"keywordsFound":["keyword1","keyword2"],"formatTips":"One format tip."}`;

    try {
      const body = JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = await httpsPost(
        'api.openai.com', '/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body
      );
      const text = parsed.choices?.[0]?.message?.content || '{}';
      return res.json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    } catch (e) {
      console.warn('[Resume] OpenAI failed:', e.message);
    }

    // Static fallback
    res.json({
      score: 72, atsScore: 68,
      summary: 'Configure OPENAI_API_KEY for AI-powered analysis.',
      strengths: ['Clear contact info', 'Structured format'],
      improvements: ['Add quantified achievements', 'Add more keywords'],
      missingSkills: [], keywordsFound: [], formatTips: 'Use bullet points consistently.',
      offline: true,
    });
  } catch (error) {
    console.error('[Resume] Error:', error);
    res.status(500).json({ error: 'Resume analysis failed. Try again.' });
  }
};

// ─── AI Career Insights ───────────────────────────────────────────────────────
exports.getCareerInsights = async (req, res) => {
  try {
    const user = req.user;
    const prompt = `Give 3 personalized career insights for:
Name: ${user.name}, Role: ${user.role}
Skills: ${user.skills?.slice(0, 8).join(', ') || 'none listed'}
Target: ${user.targetRole || 'not set'}
Department: ${user.department || 'not set'}

Return ONLY valid JSON:
{"insights":[{"title":"short title","body":"2 actionable sentences","icon":"emoji","color":"#hexcolor"},{"title":"...","body":"...","icon":"...","color":"..."},{"title":"...","body":"...","icon":"...","color":"..."}]}`;

    try {
      const body = JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = await httpsPost(
        'api.openai.com', '/v1/chat/completions',
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body
      );
      const text = parsed.choices?.[0]?.message?.content || '{}';
      return res.json(JSON.parse(text.replace(/```json|```/g, '').trim()));
    } catch (e) {
      console.warn('[Insights] OpenAI failed:', e.message);
    }

    // Static fallback
    res.json({
      insights: [
        { title: 'Skill Up Fast', body: 'Focus on your top 3 missing skills. Even 30 min/day compounds quickly.', icon: '📈', color: '#3B82F6' },
        { title: 'Network Weekly', body: 'Reach out to 2 alumni per week. Most career opportunities come through warm connections.', icon: '🤝', color: '#10B981' },
        { title: 'Build in Public', body: 'Share your projects and learnings online. Visibility accelerates career growth.', icon: '🚀', color: '#8B5CF6' },
      ],
      offline: true,
    });
  } catch (error) {
    console.error('[Insights] Error:', error);
    res.status(500).json({ error: 'Could not generate insights.' });
  }
};
