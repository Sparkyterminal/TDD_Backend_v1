const RentalContact = require('../../modals/RentalContact'); // adjust path

// Create a new rental contact
exports.createRentalContact = async (req, res) => {
  try {
    const { name, phone_number, email_id, purpose } = req.body;

    if (!name || !phone_number) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const contact = await RentalContact.create({
      name,
      phone_number,
      email_id,
      purpose
    });

    return res.status(201).json({
      message: 'Rental contact created successfully',
      contact
    });
  } catch (err) {
    console.error('Create rental contact error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get all rental contacts
exports.getRentalContacts = async (req, res) => {
  try {
    const contacts = await RentalContact.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: 'Rental contacts fetched successfully',
      total: contacts.length,
      contacts
    });
  } catch (err) {
    console.error('Get rental contacts error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
