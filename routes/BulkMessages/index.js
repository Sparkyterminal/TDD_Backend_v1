const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');
const bulkMessageController = require('../../controllers/BulkMessages');

// Admin only: WhatsApp bulk messaging via MSG91
router.post('/send-text', isAdmin, bulkMessageController.sendBulkMessages);
router.post('/send-template', isAdmin, bulkMessageController.sendTemplateBulkMessages);
router.get('/delivery-status', isAdmin, bulkMessageController.checkDeliveryStatus);

module.exports = router;
