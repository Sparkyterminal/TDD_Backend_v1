const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');
const workshopController = require('../../controllers/Workshops');

// Public
router.get('/', workshopController.getWorkshops);
router.post('/book', workshopController.bookWorkshop);
router.get('/check-status', workshopController.getStatusOfPayment); // PhonePe browser redirect

// Admin
router.post('/', isAdmin, workshopController.createWorkshop);
router.post('/manual-booking', isAdmin, workshopController.createManualBooking);

// Param routes last
router.get('/:id', workshopController.getWorkshop);
router.put('/:id', isAdmin, workshopController.updateWorkshop);
router.delete('/:id', isAdmin, workshopController.cancelWorkshop);
router.get('/:workshopId/bookings', isAdmin, workshopController.getConfirmedBookings);

module.exports = router;
