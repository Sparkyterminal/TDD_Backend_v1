const express = require('express');
const router = express.Router();
const bulkMessageController = require('../../controlers/BulkMessages');

router.post('/send-text', bulkMessageController.sendBulkMessages);
router.post('/send-template', bulkMessageController.sendTemplateBulkMessages);
router.get('/delivery-status', bulkMessageController.checkDeliveryStatus);

module.exports = router;
