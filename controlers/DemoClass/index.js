const DemoBooking = require('../../modals/DemoClass');
const { getInternalEmailFromPhone } = require('../../utils/functions');

exports.createBooking = async (req, res) => {
  try {
    const { plan, name, age, mobile_number, gender } = req.body;

    if (!plan || !name || age === undefined || !mobile_number || !gender) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const newBooking = new DemoBooking({
      plan,
      name,
      age,
      email: getInternalEmailFromPhone(mobile_number),
      mobile_number,
      gender,
    });

    const savedBooking = await newBooking.save();
    res.status(201).json(savedBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await DemoBooking.find().populate('plan');
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_contacted } = req.body;

    if (typeof is_contacted !== 'boolean') {
      return res.status(400).json({ error: 'is_contacted must be a boolean value' });
    }

    const updatedBooking = await DemoBooking.findByIdAndUpdate(
      id,
      { is_contacted },
      { new: true }
    ).populate('plan');

    if (!updatedBooking) {
      return res.status(404).json({ error: 'Demo booking not found' });
    }

    res.status(200).json({
      message: `Demo booking ${is_contacted ? 'marked as contacted' : 'marked as not contacted'}`,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Error updating contact status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
