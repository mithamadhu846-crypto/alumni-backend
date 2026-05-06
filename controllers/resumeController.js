// controllers/resumeController.js
const Groq = require('groq-sdk');

const callGroq = async (resumeText, jobDescription, targetRole) => {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const completion = await groq.chat.completions.create({
    model:       'llama3-8b-8192',
    temperature: 0.1,
    max_tokens:  1500,
    messages: [
      {
        role:    'user',
        content: `Analyze this resume. Respond with ONLY a JSON object, nothing else.

${targetRole     ? `Target Role: ${targetRole}`         : ''}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Resume:
${resumeText}

JSON format:
{"atsScore":75,"grade":"B","sectionsFound":["Experience","Education","Skills"],"extractedSkills":["skill1","skill2"],"matchedKeywords":[],"missingKeywords":[],"suggestions":["tip1","tip2","tip3","tip4"],"stats":{"wordCount":300,"skillCount":5},"source":"groq"}`,
      },
    ],
  });

  const raw = completion.choices[0].message.content.trim();
  console.log('Groq raw response:', raw.substring(0, 300));

  // Extract JSON robustly
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return valid JSON. Raw: ' + raw.substring(0, 100));
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