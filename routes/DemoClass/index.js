const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');
const demoBookingController = require('../../controllers/DemoClass');

// Public: book a demo class
router.post('/demo-bookings', demoBookingController.createBooking);

// Admin: list demo bookings / mark as contacted
router.get('/demo-bookings', isAdmin, demoBookingController.getAllBookings);
router.put('/demo-bookings/:id/contact-status', isAdmin, demoBookingController.updateContactStatus);

module.exports = router;
