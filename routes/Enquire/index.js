const express = require('express');
const router = express.Router();

const { createEnquiry, getEnquiries } = require('../../controlers/Enquire');

// POST /api/enquires - Create new enquiry
router.post('/', createEnquiry);

// GET /api/enquires - Get all enquiries
router.get('/', getEnquiries);

module.exports = router;
