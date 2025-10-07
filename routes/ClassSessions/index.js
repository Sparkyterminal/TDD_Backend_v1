const express = require('express');
const router = express.Router();
const isAuth = require('../../authentication/is-auth');
const classSessionController = require('../../controlers/ClassSessions');

// Enroll in a class session (authenticated user preferred)
router.post('/:classSessionId/enroll', isAuth, classSessionController.enrollInClassSession);

module.exports = router;


