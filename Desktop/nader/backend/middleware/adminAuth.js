const User = require('../models/User');

/**
 * Admin Auth Middleware
 * Must be used AFTER the auth middleware.
 * Checks that the logged-in user has role 'admin'.
 * Usage: router.get('/admin-only', auth, adminAuth, (req, res) => { ... })
 */
module.exports = async function (req, res, next) {
    try {
        const user = await User.findById(req.user.id).select('role');

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied. Admins only.' });
        }

        next();
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error in admin auth' });
    }
};
