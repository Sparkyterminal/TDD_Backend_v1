const express = require('express');
const router = express.Router();
const { isAuth, isAdmin, isSelfOrAdmin } = require('../../authentication/is-auth');
const classSessionController = require('../../controllers/ClassSessions');

// Public list (used by the class booking page)
router.get('/', classSessionController.getClassSessionsAdmin);

// Logged-in user
router.post('/:classSessionId/enroll', isAuth, classSessionController.enrollInClassSession);
router.put('/enrollment/:enrollmentId/cancel', isAuth, classSessionController.cancelEnrollment);
router.get('/user/:userId', isSelfOrAdmin('userId'), classSessionController.getUserClassSessions);
router.get('/user/:userId/confirmed-count', isSelfOrAdmin('userId'), classSessionController.getUserConfirmedClassesCount);
router.get('/user/:userId/weekly-report', isSelfOrAdmin('userId'), classSessionController.getUserWeeklyReport);

// Admin
router.post('/', isAdmin, classSessionController.createClassSession);
router.put('/:id', isAdmin, classSessionController.updateClassSession);
router.put('/:id/cancel', isAdmin, classSessionController.cancelClassSession);
router.get('/:id', isAdmin, classSessionController.getClassSessionById);
router.get('/:id/bookings', isAdmin, classSessionController.getClassSessionBookings);

module.exports = router;
