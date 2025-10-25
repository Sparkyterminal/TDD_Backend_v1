const express = require('express');
const router = express.Router();
const demoBookingController = require('../../controlers/DemoClass'); // Adjust path

// POST /demo-bookings - create new booking
router.post('/demo-bookings', demoBookingController.createBooking);

// GET /demo-bookings - get all bookings
router.get('/demo-bookings', demoBookingController.getAllBookings);

// PUT /demo-bookings/:id/contact-status - update contact status
router.put('/demo-bookings/:id/contact-status', demoBookingController.updateContactStatus);

module.exports = router;
