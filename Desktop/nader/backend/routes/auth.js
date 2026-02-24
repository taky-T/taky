const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

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

        user = new User({ name, email, password, phone, status: 'pending' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.json({ msg: 'Signup successful. Please wait for admin approval.' });

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

module.exports = router;
