const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// All admin routes require both auth AND admin role
router.use(auth, adminAuth);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Admin only
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ joinDate: -1 });
        res.json(users);
    } catch (err) {
        console.error('[ADMIN GET USERS]', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (active / rejected / pending)
// @access  Admin only
router.put('/users/:id/status', async (req, res) => {
    const { status } = req.body;

    if (!['pending', 'active', 'rejected'].includes(status)) {
        return res.status(400).json({ msg: 'Invalid status value' });
    }

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.status = status;
        await user.save();

        res.json({ msg: `User status updated to ${status}`, user });
    } catch (err) {
        console.error('[ADMIN UPDATE STATUS]', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Change user role (user / admin)
// @access  Admin only
router.put('/users/:id/role', async (req, res) => {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ msg: 'Invalid role value' });
    }

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.role = role;
        await user.save();

        res.json({ msg: `User role updated to ${role}`, user });
    } catch (err) {
        console.error('[ADMIN UPDATE ROLE]', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
// @access  Admin only
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User removed successfully' });
    } catch (err) {
        console.error('[ADMIN DELETE USER]', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
