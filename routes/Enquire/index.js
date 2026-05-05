const express = require('express');
const router = express.Router();
const isAuth = require('../../authentication/is-auth');

const { createEnquiry, getEnquiries, createAdminEnquiry } = require('../../controlers/Enquire');

// POST /api/enquires - Create new enquiry
router.post('/', createEnquiry);
router.post('/admin', isAuth, createAdminEnquiry);

// GET /api/enquires - Get all enquiries
router.get('/', getEnquiries);

module.exports = router;
