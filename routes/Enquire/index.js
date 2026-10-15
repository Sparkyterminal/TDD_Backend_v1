const express = require('express');
const router = express.Router();
const isAuth = require('../../authentication/is-auth');

const { createEnquiry, getEnquiries, createAdminEnquiry, updateAdminEnquiry, updateEnquiryStatus } = require('../../controlers/Enquire');

// POST /api/enquires - Create new enquiry
router.post('/', createEnquiry);
router.post('/admin', isAuth, createAdminEnquiry);
router.put('/admin/:id', isAuth, updateAdminEnquiry);
router.patch('/:id/status', isAuth, updateEnquiryStatus);

// GET /api/enquires - Get all enquiries
router.get('/', getEnquiries);

module.exports = router;
