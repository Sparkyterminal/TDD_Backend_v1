const express = require('express');
const router = express.Router();
const plansController = require('../../controlers/MembershipPlans');

router.post('/', plansController.createPlan);
router.get('/', plansController.getPlans);
router.post('/booking', plansController.createBooking);
router.get('/check-status', plansController.checkMembershipStatus);
router.get('/bookings', plansController.getMembershipBookings);
router.post('/:membershipBookingId/renew', plansController.renewMembership);
router.get('/user/:userId', plansController.getUserMemberships);
router.get('/:id', plansController.getPlanById);
router.put('/:id', plansController.updatePlan);
router.delete('/:id', plansController.deletePlan);

module.exports = router;


