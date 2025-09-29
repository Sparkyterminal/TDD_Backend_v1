const express = require('express');
const router = express.Router();
const plansController = require('../../controlers/MembershipPlans');

router.post('/', plansController.createPlan);
router.get('/', plansController.getPlans);
router.get('/:id', plansController.getPlanById);
router.put('/:id', plansController.updatePlan);
router.delete('/:id', plansController.deletePlan);
router.post('/booking', plansController.createBooking);
router.get('/check-status', plansController.checkMembershipStatus);

module.exports = router;


