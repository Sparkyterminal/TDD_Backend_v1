const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');
const renewalAlertController = require('../../controllers/RenewalAlerts');

// Admin only: trigger WhatsApp renewal reminders manually (the daily cron sends them automatically)
router.post('/send/:bookingId', isAdmin, renewalAlertController.sendRenewalAlert);
router.post('/send-bulk', isAdmin, renewalAlertController.sendBulkRenewalAlerts);

module.exports = router;
