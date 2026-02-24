const express = require('express');
const router = express.Router();
const History = require('../models/History');
const auth = require('../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer config for video uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'video-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});



// @route   POST /api/ai/chat
// @desc    Chat with AI assistant (Public)
// @access  Public
router.post('/chat', async (req, res) => {
    const { message, history = [] } = req.body;
    console.log('[AI CHAT] Request received:', { message, historyLength: history.length });

    if (!message) {
        return res.status(400).json({ msg: 'Message is required' });
    }

    try {
        const systemPrompt = `You are an AI assistant for "Couch NBS", the first intelligent video editor in Tunisia. 
Your goal is to help users understand our features: 4K Upscaling, Beauty Filters, Video Filters, and AI Image Generation.
You should be helpful, professional, and friendly. You can speak in Arabic (Tunisian dialect if possible) or French or English.
Current features:
- 4K Upscale: Converts videos to 4K quality.
- Beauty Filter: Enhances facial features and skin.
- Video Filter: Applies cinematic color filters.
- Image Generation: Generates images from text descriptions.
Cost: 35 TND per month via D17 payment.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: message }
        ];

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
        });

        const reply = completion.choices[0].message.content;

        res.json({ reply });
    } catch (err) {
        console.error('[CHAT ERROR]', err);
        res.status(500).json({ msg: 'Server error during chat', details: err.message });
    }
});

// All subsequent AI routes require authentication (Generate, History)
console.log('[AI ROUTE] Loading AI routes middleware...');
router.use(auth);

// @route   POST /api/ai/generate
// @desc    Generate AI content (logs request + returns result URL)
// @access  Private
// We use upload.single('file') to accept a video file from the frontend
router.post('/generate', (req, res, next) => {
    console.log('[AI ROUTE] POST /generate hit. Starting Multer upload...');
    next();
}, upload.single('file'), async (req, res) => {
    const { prompt, type } = req.body;
    const userId = req.user.id; // Secure: taken from JWT, not request body

    console.log('[AI GENERATE] Request received:', { type, prompt, file: req.file ? req.file.filename : 'none' });

    if (!type) {
        return res.status(400).json({ msg: 'Missing required field: type' });
    }

    try {
        let resultUrl = '';

        if (type === 'image-generation') {
            // Stability AI Core API implementation
            if (!process.env.STABILITY_API_KEY) {
                return res.status(500).json({ msg: 'Stability API key not configured on server' });
            }

            const formData = new FormData();
            formData.append('prompt', prompt || 'An empty image');
            formData.append('output_format', 'jpeg');

            console.log('[AI GENERATE] Calling Stability Core for user', userId);

            // Using native fetch since it supports FormData directly in Node 18+
            const coreResponse = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
                    'Accept': 'image/*'
                },
                body: formData
            });

            if (!coreResponse.ok) {
                const errorText = await coreResponse.text();
                throw new Error(`Stability API Error: ${errorText}`);
            }

            // Read the binary stream into a base64 string
            const arrayBuffer = await coreResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString('base64');
            resultUrl = `data:image/jpeg;base64,${base64Image}`;

        } else if (['4k-upscale', 'beauty-filter', 'video-filter'].includes(type)) {
            if (!req.file) {
                return res.status(400).json({ msg: 'A video file is required for this operation' });
            }

            const videoPath = req.file.path;
            const outputFilename = 'upscaled-' + Date.now() + '.mp4';
            // We save output in the public /frontend/assets/video directory so the browser can read it
            const publicOutputDir = path.join(__dirname, '..', '..', 'frontend', 'assets', 'video');
            if (!fs.existsSync(publicOutputDir)) {
                fs.mkdirSync(publicOutputDir, { recursive: true });
            }
            const outputPath = path.join(publicOutputDir, outputFilename);
            console.log(`[AI GENERATE] Processing video locally for ${type}, file: ${videoPath}`);

            try {
                // Determine paths for Python and the script
                // Render uses Linux, which uses 'venv/bin/python' (no .exe)
                const isWin = process.platform === "win32";

                // On Render (Linux), we typically use the system 'python3' or 'python' 
                // unless a venv was explicitly built. 
                // We'll try to find the venv first, then fallback to 'python3'
                let pythonExe = isWin
                    ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
                    : path.join(__dirname, '..', 'venv', 'bin', 'python');

                // If the venv doesn't exist on Render, just use 'python3'
                if (!isWin && !fs.existsSync(pythonExe)) {
                    pythonExe = 'python3';
                }

                const scriptPath = path.join(__dirname, '..', 'scripts', 'upscale.py');

                // Wrap in a promise to await the command
                await new Promise((resolve, reject) => {
                    console.log(`[AI GENERATE] STARTING EXECUTION: ${pythonExe}`);
                    const cmd = isWin
                        ? `"${pythonExe}" "${scriptPath}" "${videoPath}" "${outputPath}" "${type}"`
                        : `${pythonExe} "${scriptPath}" "${videoPath}" "${outputPath}" "${type}"`;

                    exec(cmd, (error, stdout, stderr) => {
                        console.log(`[AI GENERATE] EXEC FINISHED. Result code: ${error ? error.code : 0}`);
                        if (stdout) console.log('Python Stdout:', stdout);
                        if (error) {
                            console.error('Python Stderr:', stderr);
                            reject(error);
                        } else {
                            resolve(stdout);
                        }
                    });
                });

                // Generate a public URL pointing to the static folder
                resultUrl = `/assets/video/${outputFilename}`;

            } catch (localErr) {
                console.error('[AI GENERATE LOCAL ERROR]', localErr);
                throw new Error('Local Python API failed: ' + localErr.message);
            } finally {
                // Clean up the uploaded input local file after processing to save disk space
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            }

        } else {
            return res.status(400).json({ msg: `Unknown AI type: ${type}` });
        }

        // Save to user history
        const history = new History({ user: userId, type, prompt, resultUrl });
        await history.save();

        res.json({ success: true, resultUrl });

    } catch (err) {
        console.error('[AI GENERATE ERROR]', err);
        res.status(500).json({
            msg: 'Server error during AI processing',
            details: err.message,
            stack: err.stack
        });
    }
});

// @route   GET /api/ai/history
// @desc    Get user's AI generation history
// @access  Private
router.get('/history', async (req, res) => {
    try {
        const history = await History.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error('[HISTORY ERROR]', err);
        res.status(500).json({ msg: 'Server error fetching history', details: err.message });
    }
});

module.exports = router;
