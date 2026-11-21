// JWT authentication middleware.
// Tokens are sent in the Authorization header as the raw JWT (a "Bearer " prefix is also accepted).
// Token payload: { uid, role } (see controllers/User loginUsingEmail).
const jwt = require('jsonwebtoken');
const config = require('../config');
const STATUS = require('../utils/statusCodes');

function readToken(req) {
    let token = req.get('Authorization');
    if (!token) return null;
    token = token.trim();
    if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7).trim();
    return token || null;
}

/** Verifies the token. On success sets req.user = { id, role } and req.userId. */
function authenticate(req, res) {
    const token = readToken(req);
    if (!token) {
        res.status(STATUS.UNAUTHORISED).json({ message: 'Please provide the token' });
        return false;
    }
    try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = { id: decoded.uid, role: decoded.role };
        req.userId = decoded.uid;
        return true;
    } catch (error) {
        const message = error.name === 'TokenExpiredError' ? 'Your token is expired' : 'Your token is not valid';
        res.status(STATUS.UNAUTHORISED).json({ message });
        return false;
    }
}

/** Any logged-in user. */
function isAuth(req, res, next) {
    if (authenticate(req, res)) next();
}

/** Logged-in ADMIN only. */
function isAdmin(req, res, next) {
    if (!authenticate(req, res)) return;
    if (req.user.role !== 'ADMIN') {
        return res.status(STATUS.FORBIDDEN).json({ message: 'Admin access required' });
    }
    next();
}

/** Logged-in user acting on their own record (req.params[paramName]) or an ADMIN. */
function isSelfOrAdmin(paramName) {
    return function isSelfOrAdminMiddleware(req, res, next) {
        if (!authenticate(req, res)) return;
        if (req.user.role === 'ADMIN' || String(req.user.id) === String(req.params[paramName])) return next();
        return res.status(STATUS.FORBIDDEN).json({ message: 'You can only access your own data' });
    };
}

// Default export stays the plain isAuth function so `require('../../authentication/is-auth')` keeps working.
module.exports = isAuth;
module.exports.isAuth = isAuth;
module.exports.isAdmin = isAdmin;
module.exports.isSelfOrAdmin = isSelfOrAdmin;
module.exports.readToken = readToken;
