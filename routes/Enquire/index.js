const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');

const { createEnquiry, getEnquiries, createAdminEnquiry, updateAdminEnquiry, updateEnquiryStatus } = require('../../controllers/Enquire');

// Public: enquiry form
router.post('/', createEnquiry);

// Admin
router.post('/admin', isAdmin, createAdminEnquiry);
router.put('/admin/:id', isAdmin, updateAdminEnquiry);
router.patch('/:id/status', isAdmin, updateEnquiryStatus);
router.get('/', isAdmin, getEnquiries);

module.exports = router;
