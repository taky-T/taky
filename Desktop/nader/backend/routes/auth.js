const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
    let { name, email, password, phone } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!name || !email || !password) {
        return res.status(400).json({ msg: 'Please provide name, email, and password' });
    }

    // Basic regex validation for email
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: 'يرجى إدخال بريد إلكتروني صحيح.' });
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

        if (!user.isEmailVerified) {
            return res.status(403).json({ msg: 'يرجى تفعيل بريدك الإلكتروني أولاً. تحقق من علبة الوارد.' });
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

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', async (req, res) => {
    let { email } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!email) {
        return res.status(400).json({ msg: 'يرجى إدخال البريد الإلكتروني.' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'هذا البريد الإلكتروني غير مسجل.' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ msg: 'هذا الحساب مفعل مسبقاً.' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        await user.save();

        try {
            await sendVerificationEmail(email, verificationToken);
            res.json({ msg: 'تم إعادة إرسال رابط التفعيل بنجاح. تحقق من بريدك الإلكتروني.' });
        } catch (emailErr) {
            console.error('[EMAIL ERROR]', emailErr.message);
            res.status(500).json({ msg: 'فشل في إرسال البريد الإلكتروني. حاول مرة أخرى لاحقاً.' });
        }

    } catch (err) {
        console.error('[RESEND VERIFICATION ERROR]', err.message);
        res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
    let { email } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!email) {
        return res.status(400).json({ msg: 'يرجى إدخال البريد الإلكتروني.' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ msg: 'هذا البريد الإلكتروني غير مسجل.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
        await user.save();

        try {
            await sendPasswordResetEmail(email, resetToken);
            res.json({ msg: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.' });
        } catch (emailErr) {
            console.error('[EMAIL ERROR]', emailErr.message);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            res.status(500).json({ msg: 'فشل في إرسال البريد الإلكتروني. حاول مرة أخرى لاحقاً.' });
        }

    } catch (err) {
        console.error('[FORGOT PASSWORD ERROR]', err.message);
        res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
    }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using token
// @access  Public
router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ msg: 'يرجى إدخال كلمة المرور الجديدة.' });
    }

    try {
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() } // Check if token is not expired
        });

        if (!user) {
            return res.status(400).json({ msg: 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ msg: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' });

    } catch (err) {
        console.error('[RESET PASSWORD ERROR]', err.message);
        res.status(500).json({ msg: 'حدث خطأ في الخادم.' });
    }
});

module.exports = router;
