const jwt = require('jsonwebtoken');

/**
 * Auth Middleware
 * Verifies the JWT token sent in the Authorization header.
 * Usage: router.get('/protected', auth, (req, res) => { ... })
 * Access user in route via: req.user
 */
module.exports = function (req, res, next) {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change_this_secret_in_production');
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
