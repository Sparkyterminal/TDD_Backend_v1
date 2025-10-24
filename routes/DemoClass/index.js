const express = require('express');
const router = express.Router();
const demoBookingController = require('../../controlers/DemoClass'); // Adjust path

// POST /demo-bookings - create new booking
router.post('/demo-bookings', demoBookingController.createBooking);

// GET /demo-bookings - get all bookings
router.get('/demo-bookings', demoBookingController.getAllBookings);

module.exports = router;
