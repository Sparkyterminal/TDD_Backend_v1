const Workshop = require('../../models/Workshops');
const mongoose = require('mongoose');
const Booking = require('../../models/WorkshopBooking');
const config = require('../../config');
const phonepe = require('../../services/phonepe');
const whatsapp = require('../../services/whatsapp');
const { getInternalEmailFromPhone } = require('../../utils/functions');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Ticket price for one batch. MUST match getBatchPrice() in the frontend (src/pages/WorkshopDetails.jsx):
 * early-bird price while early-bird seats remain (capacity_limit is decremented per confirmed booking),
 * otherwise the regular price.
 */
function getBatchTicketPrice(batch) {
  const earlyBirdCapacity = batch.pricing?.early_bird?.capacity_limit ?? 0;
  const earlyBirdPrice = batch.pricing?.early_bird?.price ?? null;
  const regularPrice = batch.pricing?.regular?.price ?? null;
  if (earlyBirdCapacity > 0 && earlyBirdPrice !== null) return { tier: 'EARLY_BIRD', price: earlyBirdPrice };
  if (regularPrice !== null) return { tier: 'REGULAR', price: regularPrice };
  return { tier: 'REGULAR', price: 0 };
}

/** Atomically take one seat (and one early-bird slot, if any remain) for each batch. */
async function decrementBatchSeats(workshopId, batchIds) {
  for (const bId of batchIds) {
    const bIdObj = new mongoose.Types.ObjectId(bId);
    await Workshop.findOneAndUpdate(
      { _id: workshopId },
      {
        $inc: {
          'batches.$[batchCapacity].capacity': -1,
          'batches.$[batchEarlyBird].pricing.early_bird.capacity_limit': -1
        }
      },
      {
        arrayFilters: [
          { 'batchCapacity._id': bIdObj, 'batchCapacity.capacity': { $gt: 0 } },
          { 'batchEarlyBird._id': bIdObj, 'batchEarlyBird.pricing.early_bird.capacity_limit': { $gt: 0 } }
        ]
      }
    );
  }
}

exports.createWorkshop = async (req, res) => {
  try {
    let {
      title,
      description,
      media,
      date,
      tags,
      is_cancelled,
      is_active,
      batches
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Missing required fields: title, date' });
    }

    if (!batches || !Array.isArray(batches) || batches.length === 0) {
      return res.status(400).json({ error: 'batches array is required with at least one batch' });
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch.start_time || !batch.end_time) {
        return res.status(400).json({ error: `Batch ${i + 1} missing start_time or end_time` });
      }
      if (isNaN(Date.parse(batch.start_time)) || isNaN(Date.parse(batch.end_time))) {
        return res.status(400).json({ error: `Batch ${i + 1} has invalid time format` });
      }
      if (new Date(batch.end_time) <= new Date(batch.start_time)) {
        return res.status(400).json({ error: `Batch ${i + 1} end_time must be after start_time` });
      }
    }

    if (isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Normalize pricing and capacity numbers
    batches = batches.map(batch => {
      const normalized = { ...batch };
      if (normalized.pricing) {
        const pb = normalized.pricing;
        if (pb.early_bird) {
          if (typeof pb.early_bird.price === 'string') {
            const v = parseFloat(pb.early_bird.price);
            pb.early_bird.price = isNaN(v) ? undefined : v;
          }
          if (typeof pb.early_bird.capacity_limit === 'string') {
            const c = parseInt(pb.early_bird.capacity_limit, 10);
            pb.early_bird.capacity_limit = isNaN(c) ? undefined : c;
          }
        }
        if (pb.regular && typeof pb.regular.price === 'string') {
          const v = parseFloat(pb.regular.price);
          pb.regular.price = isNaN(v) ? undefined : v;
        }
        if (pb.on_the_spot && typeof pb.on_the_spot.price === 'string') {
          const v = parseFloat(pb.on_the_spot.price);
          pb.on_the_spot.price = isNaN(v) ? undefined : v;
        }
      }
      if (typeof normalized.capacity === 'string') {
        const c = parseInt(normalized.capacity, 10);
        normalized.capacity = isNaN(c) ? undefined : c;
      }
      return normalized;
    });

    const workshopData = {
      media,
      title,
      description,
      date: new Date(date),
      tags,
      is_cancelled: is_cancelled ?? false,
      is_active: is_active ?? true,
      batches: batches.map(batch => ({
        name: batch.name, // Added name here
        start_time: new Date(batch.start_time),
        end_time: new Date(batch.end_time),
        capacity: batch.capacity,
        pricing: {
          early_bird: {
            price: batch.pricing?.early_bird?.price,
            capacity_limit: batch.pricing?.early_bird?.capacity_limit
          },
          regular: {
            price: batch.pricing?.regular?.price
          },
          on_the_spot: {
            price: batch.pricing?.on_the_spot?.price
          }
        },
        is_cancelled: batch.is_cancelled ?? false
      }))
    };

    const workshop = new Workshop(workshopData);
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
      // Uncomment and enable if instructor_user_ids field is used
      /*
      .populate({
        path: 'instructor_user_ids',
        select: 'first_name last_name email_data phone_data role is_active is_archived',
        populate: { path: 'media' }
      })
      */
      .populate('media'); // Populate media references

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
    const workshops = await Workshop.find()
      // Uncomment and enable if you add instructor_user_ids field in schema
      /*
      .populate({
        path: 'instructor_user_ids',
        select: 'first_name last_name email_data phone_data role is_active is_archived',
        populate: { path: 'media' }
      })
      */
      .populate('media') // Populate media references
      .sort({ date: 1 }); // Sort by workshop date ascending

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

    // Validate and convert date fields at top-level only
    if (updateData.date && isNaN(Date.parse(updateData.date))) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    // Note: start_time and end_time are batch fields; handle batch updates separately

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

// Public: start a workshop booking and return the PhonePe checkout URL.
exports.bookWorkshop = async (req, res) => {
  try {
    const { workshopId, batchIds, name, age, mobile_number, gender, price } = req.body;

    // Validate required fields
    if (!workshopId || !name || !age || !mobile_number || !gender || price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ error: 'Invalid workshopId' });
    }
    if (!Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ error: 'batchIds array is required' });
    }
    for (const bId of batchIds) {
      if (!isValidObjectId(bId)) {
        return res.status(400).json({ error: 'Invalid batchId in batchIds' });
      }
    }
    if (new Set(batchIds.map(String)).size !== batchIds.length) {
      return res.status(400).json({ error: 'Each batch can be booked only once per booking' });
    }
    if (typeof age !== 'number' || age < 0) {
      return res.status(400).json({ error: 'Invalid age' });
    }
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender' });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const workshop = await Workshop.findOne({ _id: workshopId, is_cancelled: false, is_active: true });
    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found or unavailable.' });
    }

    // Price is computed on the server; the client's price is only used to detect a stale page.
    const pricingDetails = [];
    for (const bId of batchIds) {
      const batch = workshop.batches.id(bId);
      if (!batch || batch.is_cancelled) {
        return res.status(404).json({ error: 'Selected batch not found or cancelled.' });
      }
      if (typeof batch.capacity === 'number' && batch.capacity <= 0) {
        return res.status(400).json({ error: 'No more slots available for one of the batches.' });
      }
      const { tier, price: ticketPrice } = getBatchTicketPrice(batch);
      pricingDetails.push({ batch_id: batch._id, pricing_tier: tier, price: ticketPrice });
    }

    const ticketsTotal = pricingDetails.reduce((sum, d) => sum + d.price, 0);
    if (ticketsTotal <= 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }
    if (Math.abs(ticketsTotal - price) > 0.009) {
      return res.status(409).json({
        error: 'Ticket prices have changed. Please refresh the page and try again.',
        expectedPrice: ticketsTotal
      });
    }

    const totalPrice = ticketsTotal + config.fees.workshopProcessing;
    const booking = new Booking({
      workshop: workshopId,
      batch_ids: batchIds,
      name,
      age,
      email: getInternalEmailFromPhone(mobile_number),
      mobile_number,
      gender,
      status: 'INITIATED',
      pricing_details: pricingDetails,
      price_charged: totalPrice,
      paymentResult: { status: 'initiated' }
    });
    await booking.save();

    // The booking _id is the PhonePe merchantOrderId
    const checkoutPageUrl = await phonepe.createCheckout({
      merchantOrderId: booking._id.toString(),
      amountInRupees: totalPrice,
      statusPath: 'workshop/check-status'
    });

    return res.status(201).json({ checkoutPageUrl, bookingId: booking._id });
  } catch (error) {
    console.error('Error in booking workshop:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};

// Public: PhonePe redirects the customer's browser here after payment.
exports.getStatusOfPayment = async (req, res) => {
  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId) {
      return res.status(400).send('merchantOrderId is required');
    }
    if (!isValidObjectId(merchantOrderId)) {
      return res.status(400).send('Invalid merchantOrderId');
    }

    const existing = await Booking.findById(merchantOrderId).lean();
    if (!existing) {
      return res.status(404).send('Booking not found');
    }
    // Already processed (page refresh / back button): never confirm, decrement seats or message twice.
    if (existing.status === 'CONFIRMED') {
      return res.redirect(config.urls.paymentSuccess);
    }

    const response = await phonepe.getOrderStatus(merchantOrderId);

    if (response.state !== 'COMPLETED') {
      await Booking.findByIdAndUpdate(merchantOrderId, {
        'paymentResult.status': 'FAILED',
        'paymentResult.phonepeResponse': response,
        status: 'FAILED'
      });
      return res.redirect(config.urls.paymentFailure);
    }

    // Claim the booking so concurrent requests for the same order cannot both process it.
    const claimed = await Booking.findOneAndUpdate(
      { _id: merchantOrderId, status: { $ne: 'CONFIRMED' }, 'paymentResult.processing': { $ne: true } },
      { $set: { 'paymentResult.processing': true } },
      { new: true }
    );
    if (!claimed) {
      return res.redirect(config.urls.paymentSuccess);
    }

    const workshopDoc = await Workshop.findById(claimed.workshop).lean();
    let capacityOk = Boolean(workshopDoc && !workshopDoc.is_cancelled && workshopDoc.is_active);
    if (capacityOk) {
      for (const bId of claimed.batch_ids || []) {
        const batch = workshopDoc.batches?.find(b => b._id.toString() === bId.toString());
        if (!batch || batch.is_cancelled) {
          capacityOk = false;
          break;
        }
      }
    }

    if (!capacityOk) {
      await Booking.findByIdAndUpdate(merchantOrderId, {
        'paymentResult.status': 'FAILED',
        'paymentResult.phonepeResponse': response,
        'paymentResult.processing': false,
        status: 'FAILED'
      });
      return res.redirect(config.urls.paymentFailure);
    }

    await decrementBatchSeats(claimed.workshop, claimed.batch_ids || []);

    const updatedBooking = await Booking.findByIdAndUpdate(
      merchantOrderId,
      {
        'paymentResult.status': 'COMPLETED',
        'paymentResult.paymentDate': new Date(),
        'paymentResult.phonepeResponse': response,
        'paymentResult.processing': false,
        status: 'CONFIRMED'
      },
      { new: true }
    ).populate('workshop');

    // WhatsApp confirmation (failures are logged, the booking stays confirmed)
    try {
      const batch = updatedBooking.workshop?.batches?.find(b =>
        updatedBooking.batch_ids.map(String).includes(b._id.toString())
      );
      await whatsapp.sendWorkshopConfirmation({
        mobileNumber: updatedBooking.mobile_number,
        name: updatedBooking.name,
        workshopTitle: updatedBooking.workshop?.title,
        date: updatedBooking.workshop?.date ? new Date(updatedBooking.workshop.date).toLocaleDateString('en-GB') : 'TBA',
        time: batch?.start_time
          ? new Date(batch.start_time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
          : 'TBA',
        location: updatedBooking.workshop?.location
      });
    } catch (error) {
      console.error('Failed to send WhatsApp workshop confirmation:', error.response?.data || error.message);
    }

    return res.redirect(config.urls.paymentSuccess);
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

exports.createManualBooking = async (req, res) => {
  try {
    const {
      workshopId,
      name,
      age,
      mobile_number, 
      gender, 
      payment_status,
      price_charged
    } = req.body;
    let { batchIds } = req.body; // reassigned below when no batch is chosen

    // Validate required fields
    if (!workshopId || !name || !age || !mobile_number || !gender) {
      return res.status(400).json({ 
        success: false,
        error: 'Workshop ID, name, age, mobile number, and gender are required' 
      });
    }

    const internalEmail = getInternalEmailFromPhone(mobile_number);

    // Validate IDs
    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid workshop ID' 
      });
    }

    // Validate workshop exists
    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({ 
        success: false,
        error: 'Workshop not found' 
      });
    }

    // Validate batches exist in workshop (if provided)
    if (batchIds && Array.isArray(batchIds) && batchIds.length > 0) {
      for (const batchId of batchIds) {
        if (!isValidObjectId(batchId)) {
          return res.status(400).json({ 
            success: false,
            error: 'Invalid batch ID' 
          });
        }
        
        const batch = workshop.batches.find(b => b._id.toString() === batchId);
        if (!batch) {
          return res.status(400).json({ 
            success: false,
            error: 'Selected batch not found in the workshop' 
          });
        }

        // Check capacity if batch has capacity limit
        if (typeof batch.capacity === 'number' && batch.capacity <= 0) {
          return res.status(400).json({ 
            success: false,
            error: 'Selected batch is full' 
          });
        }
      }
    } else {
      // If no batchIds provided, default to first available batch
      if (workshop.batches && workshop.batches.length > 0) {
        batchIds = [workshop.batches[0]._id];
      } else {
        return res.status(400).json({ 
          success: false,
          error: 'No batches available for this workshop' 
        });
      }
    }

    // Validate payment status
    const validPaymentStatuses = ['initiated', 'COMPLETED', 'FAILED', 'PENDING', 'CONFIRMED'];
    if (payment_status && !validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid payment status. Must be one of: initiated, COMPLETED, FAILED, PENDING, CONFIRMED' 
      });
    }

    // Determine pricing tier
    const pricingDetails = [];
    for (const batchId of batchIds) {
      const batch = workshop.batches.find(b => b._id.toString() === String(batchId));
      
      if (!batch) continue;

      // Same rule as online booking; fall back to on-the-spot price when no regular price is set
      let { tier, price } = getBatchTicketPrice(batch);
      if (tier === 'REGULAR' && batch.pricing?.regular?.price == null && batch.pricing?.on_the_spot?.price != null) {
        tier = 'ON_THE_SPOT';
        price = batch.pricing.on_the_spot.price;
      }

      pricingDetails.push({ 
        batch_id: batch._id, 
        pricing_tier: tier, 
        price 
      });
    }

    // Calculate total price (+ processing fee)
    const calculatedPrice = pricingDetails.reduce((sum, detail) => sum + detail.price, 0) + config.fees.workshopProcessing;
    const finalPrice = price_charged || calculatedPrice;

    // Create the booking
    const bookingData = {
      workshop: workshopId,
      batch_ids: batchIds,
      name,
      age,
      email: internalEmail,
      mobile_number,
      gender,
      pricing_details: pricingDetails,
      price_charged: finalPrice,
      status: payment_status === 'COMPLETED' || payment_status === 'CONFIRMED' ? 'CONFIRMED' : 'INITIATED',
      paymentResult: {
        status: payment_status || 'initiated'
      }
    };

    const newBooking = await Booking.create(bookingData);

    // Decrement batch capacity if payment is COMPLETED/CONFIRMED
    if (payment_status === 'COMPLETED' || payment_status === 'CONFIRMED') {
      await decrementBatchSeats(workshopId, batchIds);
    }

    // Populate the response
    const populatedBooking = await Booking.findById(newBooking._id)
      .populate('workshop', 'title description date media')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Workshop booking created successfully',
      data: populatedBooking
    });

  } catch (error) {
    console.error('Error creating manual booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating manual booking',
      error: error.message
    });
  }
};
