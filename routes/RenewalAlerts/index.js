const express = require('express');
const router = express.Router();
const renewalAlertController = require('../../controlers/RenewalAlerts');

// Routes for renewal alerts
router.post('/send/:bookingId', renewalAlertController.sendRenewalAlert);
router.post('/send-bulk', renewalAlertController.sendBulkRenewalAlerts);
router.get('/stats', renewalAlertController.getRenewalAlertStats);

module.exports = router;
