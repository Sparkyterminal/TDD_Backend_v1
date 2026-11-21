const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../authentication/is-auth');
const rentalContactsController = require('../../controllers/RentalContact');

// Public: rental enquiry form
router.post('/', rentalContactsController.createRentalContact);

// Admin: list rental enquiries
router.get('/', isAdmin, rentalContactsController.getRentalContacts);

module.exports = router;
