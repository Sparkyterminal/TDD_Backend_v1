const Workshop = require('../../modals/Workshops');
const mongoose = require('mongoose');
const Booking = require('../../modals/WorkshopBooking');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const clientVersion = 1
const env = Env.SANDBOX
const client = StandardCheckoutClient.getInstance(clientId,clientSecret,clientVersion,env)
function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

exports.createWorkshop = async (req, res) => {
    try {
      let {
        title,
        description,
        instructor_user_ids,
        instructor,
        media,
        image,
        date,
        start_time,
        end_time,
        capacity,
        price,
        tags,
        is_cancelled,
        is_active
      } = req.body;
  
      // Use image as media array if media not provided
      if (!media && image) {
        media = [image];
      }
  
      // Use instructor string as single-element array if instructor_user_ids not provided
      if (!instructor_user_ids && instructor) {
        instructor_user_ids = [instructor];
      }
  
      // Validate required fields
      if (!title || !date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields: title, date, start_time, end_time' });
      }
  
      // Validate date and times
      if (isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (isNaN(Date.parse(start_time)) || isNaN(Date.parse(end_time))) {
        return res.status(400).json({ error: 'Invalid start_time or end_time format' });
      }
  
      // Validate instructor_user_ids and media as arrays if present
      if (instructor_user_ids && !Array.isArray(instructor_user_ids)) {
        return res.status(400).json({ error: 'instructor_user_ids must be an array of IDs' });
      }
      if (media && !Array.isArray(media)) {
        return res.status(400).json({ error: 'media must be an array of IDs' });
      }
  
      // Convert capacity and price to numbers if they are string
      if (capacity && typeof capacity === 'string') {
        capacity = parseInt(capacity, 10);
        if (isNaN(capacity)) capacity = undefined;
      }
      if (price && typeof price === 'string') {
        price = parseFloat(price);
        if (isNaN(price)) price = undefined;
      }
  
      const workshop = new Workshop({
        title,
        description,
        instructor_user_ids,
        media,
        date: new Date(date),
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        capacity,
        price,
        tags,
        is_cancelled: is_cancelled ?? false,
        is_active: is_active ?? true
      });
  
      await workshop.save();
      return res.status(201).json(workshop);
  
    } catch (err) {
      console.error('Create workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
  

exports.getWorkshop = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid workshop ID' });
        }

        const workshop = await Workshop.findById(id)
            .populate('instructor_user_ids', '-password -__v')
            .populate('media');

        if (!workshop) {
            return res.status(404).json({ error: 'Workshop not found' });
        }

        return res.json(workshop);
    } catch (err) {
        console.error('Get workshop error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getWorkshops = async (req, res) => {
    try {
        // Optionally add filters, pagination here
        const workshops = await Workshop.find()
            .populate('instructor_user_ids', '-password -__v')
            .populate('media')
            .sort({ start_at: 1 });
        return res.json(workshops);
    } catch (err) {
        console.error('Get workshops error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.updateWorkshop = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid workshop ID' });
      }
  
      const updateData = { ...req.body };
  
      if (updateData.date && isNaN(Date.parse(updateData.date))) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (updateData.start_time && isNaN(Date.parse(updateData.start_time))) {
        return res.status(400).json({ error: 'Invalid start_time format' });
      }
      if (updateData.end_time && isNaN(Date.parse(updateData.end_time))) {
        return res.status(400).json({ error: 'Invalid end_time format' });
      }
  
      // Convert to Date objects without renaming fields
      if (updateData.start_time) {
        updateData.start_time = new Date(updateData.start_time);
      }
      if (updateData.end_time) {
        updateData.end_time = new Date(updateData.end_time);
      }
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }
  
      const updatedWorkshop = await Workshop.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true
      });
  
      if (!updatedWorkshop) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
  
      return res.json(updatedWorkshop);
    } catch (err) {
      console.error('Update workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
};
  

exports.cancelWorkshop = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid workshop ID' });
      }
  
      const updatedWorkshop = await Workshop.findByIdAndUpdate(
        id,
        { is_cancelled: true, is_active: false }, // mark cancelled and optionally deactivate
        { new: true }
      );
  
      if (!updatedWorkshop) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
  
      return res.json({
        message: 'Workshop cancelled successfully',
        workshop: updatedWorkshop
      });
    } catch (err) {
      console.error('Cancel workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
};  
  
exports.bookWorkshop = async (req, res) => {
  try {
    const { workshopId, name, age, email, mobile_number, gender } = req.body;

    // Validate required fields
    if (!workshopId || !name || !age || !email || !mobile_number || !gender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ error: 'Invalid workshopId' });
    }
    if (typeof age !== 'number' || age < 0) {
      return res.status(400).json({ error: 'Invalid age' });
    }
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender' });
    }

    // Get latest workshop document
    const workshop = await Workshop.findOne({
      _id: workshopId,
      is_cancelled: false,
      is_active: true,
    });

    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found or unavailable.' });
    }

    // Check for capacity (do not decrement here)
    if (workshop.capacity && workshop.capacity <= 0) {
      return res.status(400).json({ error: 'No more slots available for booking.' });
    }

    // Create booking with status INITIATED (pending payment)
    const booking = new Booking({
      workshop: workshopId,
      name,
      age,
      email,
      mobile_number,
      gender,
      status: 'INITIATED',
      paymentResult: {
        status: 'initiated'
      }
    });

    await booking.save();

    const merchantOrderId = booking._id.toString();
    console.log('merchantOrderId:', merchantOrderId);

    // Redirect URL to receive payment status
    const redirectUrl = `http://localhost:4044/workshop/check-status?merchantOrderId=${merchantOrderId}`;
    // In production, use your deployed backend URL instead

    // Price in paise (assumes price is in INR)
    const priceInPaise = Math.round((workshop.price || 0) * 100);

    // Build payment request
    const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
      .merchantOrderId(merchantOrderId)
      .amount(priceInPaise)
      .redirectUrl(redirectUrl)
      .build();

    // Call payment client
    const paymentResponse = await client.pay(paymentRequest);

    return res.status(201).json({
      message: 'Booking initiated. Please complete payment.',
      booking,
      checkoutPageUrl: paymentResponse.redirectUrl,
    });

  } catch (error) {
    console.error('Error in booking workshop:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getStatusOfPayment = async (req, res) => {
  console.log('getStatusOfPayment invoked with query:', req.query);

  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId) {
      return res.status(400).send("merchantOrderId is required");
    }

    // Retrieve payment status from your payment client
    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;

    if (status === 'COMPLETED') {
      // Find the booking and related workshop
      const booking = await Booking.findById(merchantOrderId);
      if (!booking) {
        return res.status(404).send("Booking submission not found");
      }

      // Decrement capacity ONLY NOW (payment success), atomically
      const workshop = await Workshop.findOneAndUpdate(
        {
          _id: booking.workshop,
          is_cancelled: false,
          is_active: true,
          capacity: { $gt: 0 }
        },
        {
          $inc: { capacity: -1 }
        },
        { new: true }
      );

      if (!workshop) {
        // Capacity already full, update booking as failed and redirect failure
        await Booking.findByIdAndUpdate(
          merchantOrderId,
          {
            'paymentResult.status': 'FAILED',
            'paymentResult.phonepeResponse': response,
            status: 'FAILED'
          }
        );
        return res.redirect(`http://localhost:5173/payment-failure`);
      }

      // Mark booking as CONFIRMED
      await Booking.findByIdAndUpdate(
        merchantOrderId,
        {
          'paymentResult.status': 'COMPLETED',
          'paymentResult.paymentDate': new Date(),
          'paymentResult.phonepeResponse': response,
          status: 'CONFIRMED'
        }
      );

      // Optionally, send confirmation SMS here using updated data

      return res.redirect(`http://localhost:5173/payment-success`);
    } else {
      await Booking.findByIdAndUpdate(
        merchantOrderId,
        {
          'paymentResult.status': 'FAILED',
          'paymentResult.phonepeResponse': response,
          status: 'FAILED'
        }
      );

      return res.redirect(`http://localhost:5173/payment-failure`);
    }
  } catch (error) {
    console.error('Error while checking payment status:', error);
    return res.status(500).send('Internal server error during payment status check');
  }
};

exports.getConfirmedBookings = async (req, res) => {
  try {
    const { workshopId } = req.params;

    console.log('Received workshopId:', workshopId);

    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ error: 'Invalid workshopId' });
    }

    const bookings = await Booking.find({
      workshop: workshopId,
      status: 'CONFIRMED'
    })
    .populate('workshop')
    .sort({ bookedAt: -1 });

    return res.status(200).json({ confirmedBookings: bookings });
  } catch (error) {
    console.error('Error fetching confirmed bookings:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
