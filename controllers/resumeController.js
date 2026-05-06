// controllers/resumeController.js
const Groq = require('groq-sdk');

const callGroq = async (resumeText, jobDescription, targetRole) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model:           'llama-3.1-8b-instant',
    temperature:     0.1,
    max_tokens:      2048,
    response_format: { type: 'json_object' },
    messages: [
      {
        role:    'system',
        content: 'You are a resume analyzer API. You always respond with valid JSON only.',
      },
      {
        role:    'user',
        content: `Analyze this resume and return a JSON object with these keys:
- atsScore (integer 0-100)
- grade (string: "A" for 80-100, "B" for 65-79, "C" for 45-64, "F" for 0-44)
- sectionsFound (array of strings like ["Experience","Education","Skills"])
- extractedSkills (array of skill strings found in resume)
- matchedKeywords (array of keywords from job description found in resume, empty if no JD)
- missingKeywords (array of keywords from job description missing in resume, empty if no JD)
- suggestions (array of exactly 4 improvement tip strings)
- stats (object with wordCount and skillCount as integers)
- source (string "groq")

${targetRole     ? `Target Role: ${targetRole}`         : ''}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Resume:
${resumeText.substring(0, 2000)}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content.trim();
  console.log('Groq raw:', raw.substring(0, 200));

  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return valid JSON. Raw: ' + raw.substring(0, 150));
  }
  return JSON.parse(raw.slice(start, end + 1));
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