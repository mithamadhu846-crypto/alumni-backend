// routes/resumeRoutes.js
const express  = require('express');
const multer   = require('multer');
const { analyzeResume, uploadResume } = require('../controllers/resumeController');

const router = express.Router();

// Multer: store PDF in memory (no disk write needed — we send buffer to Claude)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// POST /resume/analyze  — plain text resume
router.post('/analyze', analyzeResume);

// POST /resume/upload   — PDF file resume
router.post('/upload', upload.single('resume'), uploadResume);

module.exports = router;