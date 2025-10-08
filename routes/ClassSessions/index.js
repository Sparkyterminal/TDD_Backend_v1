const express = require('express');
const router = express.Router();
const isAuth = require('../../authentication/is-auth');
const classSessionController = require('../../controlers/ClassSessions');

// Enroll in a class session (authenticated user preferred)
router.post('/:classSessionId/enroll', isAuth, classSessionController.enrollInClassSession);

// Admin create class session
router.post('/', isAuth, classSessionController.createClassSession);

// Admin list/search class sessions
router.get('/', classSessionController.getClassSessionsAdmin);

// Admin update class session
router.put('/:id', isAuth, classSessionController.updateClassSession);

// Admin cancel class session
router.put('/:id/cancel', isAuth, classSessionController.cancelClassSession);

// User get class sessions for a specific user
router.get('/user/:userId', classSessionController.getUserClassSessions);

// User get confirmed classes count
router.get('/user/:userId/confirmed-count', classSessionController.getUserConfirmedClassesCount);

// User cancel enrollment
router.put('/enrollment/:enrollmentId/cancel', classSessionController.cancelEnrollment);

// Admin get class session by id
router.get('/:id', isAuth, classSessionController.getClassSessionById);

module.exports = router;


