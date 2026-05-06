// controllers/resumeController.js
// Resume analysis using Groq API (completely free, no credit card needed)
const Groq = require('groq-sdk');

const buildPrompt = (resumeText, jobDescription, targetRole) => `
You are an expert ATS (Applicant Tracking System) resume analyzer.
Analyze the resume below and return ONLY a valid JSON object — no markdown, no explanation, no backticks.

${targetRole     ? `Target Role: ${targetRole}`         : ''}
${jobDescription ? `Job Description:\n${jobDescription}` : ''}

Resume:
${resumeText}

Return this exact JSON structure:
{
  "atsScore": <number 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "sectionsFound": ["Experience","Education","Skills"],
  "extractedSkills": ["skill1","skill2"],
  "matchedKeywords": [],
  "missingKeywords": [],
  "suggestions": ["tip1","tip2","tip3","tip4"],
  "stats": { "wordCount": 300, "skillCount": 5 },
  "source": "groq"
}
Scoring: 80-100=A, 65-79=B, 45-64=C, 0-44=D/F
`;

const callGroq = async (resumeText, jobDescription, targetRole) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model:    'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are an expert ATS resume analyzer. Always respond with valid JSON only, no markdown, no backticks.' },
      { role: 'user',   content: buildPrompt(resumeText, jobDescription, targetRole) },
    ],
    temperature:     0.3,
    max_tokens:      1000,
    response_format: { type: 'json_object' },
  });
  const raw = completion.choices[0].message.content.trim();
  return JSON.parse(raw);
};

// Extract text from PDF buffer — no external library needed
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

// ── POST /resume/analyze  (text) ─────────────────────────────────────────────
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

// ── POST /resume/upload  (PDF) ───────────────────────────────────────────────
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