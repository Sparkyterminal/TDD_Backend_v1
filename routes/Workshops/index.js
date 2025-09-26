const express = require('express');
const router = express.Router();
const workshopController = require('../../controlers/Workshops');

router.post('/', workshopController.createWorkshop);
router.get('/', workshopController.getWorkshops);
router.post('/book', workshopController.bookWorkshop);
router.get('/check-status', workshopController.getStatusOfPayment);
router.get('/:id', workshopController.getWorkshop);
router.put('/:id', workshopController.updateWorkshop);
router.delete('/:id', workshopController.cancelWorkshop);
router.get('/:workshopId/bookings', workshopController.getConfirmedBookings);


module.exports = router;
