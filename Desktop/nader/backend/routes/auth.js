const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const sendVerificationEmail = require('../utils/email');

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
    let { name, email, password, phone } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Please provide name, email, and password' });
    }

    try {
        let user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email' });
        }


        const verificationToken = crypto.randomBytes(32).toString('hex');
        user = new User({ name, email, password, phone, status: 'pending', emailVerificationToken: verificationToken });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (emailErr) {
            console.error('[EMAIL ERROR]', emailErr.message);
            // We don't fail the signup if the email fails, but we should log it
            // Ideally, you'd show a message saying "Signup successful, but failed to send email. Contact admin."
        }

        res.json({ msg: 'Signup successful. Please check your email to verify your account.' });

    } catch (err) {
        console.error('[SIGNUP ERROR]', err.message);
        res.status(500).json({ msg: 'Server error during signup' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    let { email, password } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please provide email and password' });
    }

    try {
        console.log(`[LOGIN] Attempt for: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ msg: `Account status: ${user.status}. Access denied.` });
        }

        const payload = {
            user: { id: user.id, role: user.role }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'change_this_secret_in_production',
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: { id: user.id, name: user.name, email: user.email, role: user.role }
                });
            }
        );

    } catch (err) {
        console.error('[LOGIN ERROR]', err.message);
        res.status(500).json({ msg: 'Server error during login' });
    }
});

// @route   GET /api/auth/user
// @desc    Get the currently logged-in user's info
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error('[GET USER ERROR]', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({ emailVerificationToken: req.params.token });

        if (!user) {
            return res.status(400).send('<h1>Invalid Verification Token</h1><p>The link may be expired or invalid.</p>');
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined; // Clear token after use
        await user.save();

        res.send('<h1>Email Verified Successfully! ✅</h1><p>You can now close this window and wait for admin approval manually, or <a href="/login.html">login here</a> if you are already approved.</p>');

    } catch (err) {
        console.error('[VERIFICATION ERROR]', err.message);
        res.status(500).send('<h1>Server Error</h1>');
    }
});

module.exports = router;
