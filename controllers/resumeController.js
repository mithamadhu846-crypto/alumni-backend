// controllers/resumeController.js
const Groq = require('groq-sdk');

const callGroq = async (resumeText, jobDescription, targetRole) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens:  1000,
    messages: [
      {
        role:    'system',
        content: 'You are a JSON API. You only output valid JSON. No markdown. No backticks. No explanation. Only a JSON object.',
      },
      {
        role:    'user',
        content: `Analyze this resume and return a JSON object with these exact keys:
- atsScore: integer 0-100
- grade: one of "A","B","C","D","F"  (A=80-100, B=65-79, C=45-64, D/F=0-44)
- sectionsFound: array of section names found (e.g. ["Experience","Education","Skills"])
- extractedSkills: array of skills found in resume
- matchedKeywords: array of keywords from job description found in resume (empty array if no job description)
- missingKeywords: array of important keywords missing from resume (empty array if no job description)
- suggestions: array of 4 specific improvement tips
- stats: object with wordCount and skillCount as integers
- source: "groq"

${targetRole     ? `Target Role: ${targetRole}`         : ''}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Resume text:
${resumeText}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(raw);
};

// Extract text from PDF buffer
const extractTextFromPDF = (buffer) => {
  const str = buffer.toString('latin1');
  const textParts = [];
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(str)) !== null) {
    const strRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(match[1])) !== null) {
      const text = strMatch[1]
        .replace(/\\n/g, ' ').replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ').replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')').replace(/\\\\/g, '\\').trim();
      if (text.length > 0) textParts.push(text);
    }
  }
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
};

// ── POST /resume/analyze ─────────────────────────────────────────────────────
const analyzeResume = async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env file.' });
    }
    const { resumeText, jobDescription = '', targetRole = '' } = req.body;
    if (!resumeText || resumeText.trim().length < 30) {
      return res.status(400).json({ error: 'Resume text is too short (minimum 30 characters).' });
    }
    const result = await callGroq(resumeText.trim(), jobDescription, targetRole);
    return res.json(result);
  } catch (err) {
    console.error('analyzeResume error:', err.message);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
};

// ── POST /resume/upload ──────────────────────────────────────────────────────
const uploadResume = async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not set in .env file.' });
    }
    const { jobDescription = '', targetRole = '' } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const resumeText = extractTextFromPDF(req.file.buffer);
    if (!resumeText || resumeText.trim().length < 30) {
      return res.status(400).json({ error: 'Could not extract text from this PDF. Please paste your resume as text instead.' });
    }

    const result = await callGroq(resumeText.trim(), jobDescription, targetRole);
    return res.json(result);
  } catch (err) {
    console.error('uploadResume error:', err.message);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
};

module.exports = { analyzeResume, uploadResume };