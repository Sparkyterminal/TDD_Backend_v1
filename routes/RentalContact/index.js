const express = require('express');
const router = express.Router();
const rentalContactsController = require('../../controlers/RentalContact'); // adjust path

// POST - create a new rental contact
router.post('/', rentalContactsController.createRentalContact);

// GET - fetch all rental contacts
router.get('/', rentalContactsController.getRentalContacts);

module.exports = router;
