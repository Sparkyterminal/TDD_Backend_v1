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
        // media,
        // image,             
        date,
        tags,
        is_cancelled,
        is_active,
        batches
      } = req.body;
  
      // Use image as media array if media not provided
      // if (!media && image) {
      //   media = [image];
      // }
  
      // Use instructor string as single-element array if instructor_user_ids not provided
      if (!instructor_user_ids && instructor) {
        instructor_user_ids = [instructor];
      }
  
      // Validate required fields
      if (!title || !date) {
        return res.status(400).json({ error: 'Missing required fields: title, date' });
      }

      // Validate batches
      if (!batches || !Array.isArray(batches) || batches.length === 0) {
        return res.status(400).json({ error: 'batches array is required with at least one batch' });
      }

      // Validate each batch
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
  
      // Validate date and times
      if (isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      // No legacy start/end time validation; batches are required
  
      // Validate instructor_user_ids and media as arrays if present
      if (instructor_user_ids && !Array.isArray(instructor_user_ids)) {
        return res.status(400).json({ error: 'instructor_user_ids must be an array of IDs' });
      }
      // if (image && !Array.isArray(image)) {
      //   return res.status(400).json({ error: 'image must be an array of IDs' });
      // }
      // if (media && !Array.isArray(media)) {
      //   return res.status(400).json({ error: 'media must be an array of IDs' });
      // }
  
      // Normalize batch pricing numbers
      batches = batches.map((batch) => {
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
  
      // Prepare workshop data
      const workshopData = {
        title,
        description,
        instructor_user_ids,
        // media,
        date: new Date(date),
        tags,
        is_cancelled: is_cancelled ?? false,
        is_active: is_active ?? true
      };

      // Process batches
      workshopData.batches = batches.map(batch => ({
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
      }));

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
            .populate({
              path: 'instructor_user_ids',
              select: 'first_name last_name email_data phone_data role is_active is_archived media',
              populate: { path: 'media' }
            })
            // .populate('media');

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
            .populate({
                path: 'instructor_user_ids',
                select: 'first_name last_name email_data phone_data role is_active is_archived media',
                populate: { path: 'media' }
            })
            // .populate('media')
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
    const { workshopId, batchId, batchIds, name, age, email, mobile_number, gender } = req.body;

    // Validate required fields
    if (!workshopId || !name || !age || !email || !mobile_number || !gender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ error: 'Invalid workshopId' });
    }
    const batchIdList = Array.isArray(batchIds) ? batchIds : (batchId ? [batchId] : []);
    if (batchIdList.length === 0) {
      return res.status(400).json({ error: 'Provide batchId or batchIds[]' });
    }
    if (!batchIdList.every(isValidObjectId)) {
      return res.status(400).json({ error: 'Invalid batchId in list' });
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

    // Prepare results per batch
    const results = [];
    for (const bId of batchIdList) {
      const batch = workshop.batches.find(b => b._id.toString() === bId);
      if (!batch || batch.is_cancelled) {
        results.push({ batchId: bId, error: 'Selected batch not found or cancelled.' });
        continue;
      }
      if (typeof batch.capacity === 'number' && batch.capacity <= 0) {
        results.push({ batchId: bId, error: 'No more slots available for this batch.' });
        continue;
      }

      // Determine pricing tier based on early_bird capacity_limit vs existing bookings
      const earlyLimit = batch.pricing?.early_bird?.capacity_limit ?? 0;
      const earlyCount = await Booking.countDocuments({ workshop: workshopId, batch_id: bId, pricing_tier: 'EARLY_BIRD' });
      let pricing_tier = 'REGULAR';
      if (earlyLimit > 0 && earlyCount < earlyLimit && batch.pricing?.early_bird?.price != null) {
        pricing_tier = 'EARLY_BIRD';
      }
      let price = null;
      if (pricing_tier === 'EARLY_BIRD') {
        price = batch.pricing.early_bird.price;
      } else if (batch.pricing?.regular?.price != null) {
        price = batch.pricing.regular.price;
      } else if (batch.pricing?.on_the_spot?.price != null) {
        pricing_tier = 'ON_THE_SPOT';
        price = batch.pricing.on_the_spot.price;
      } else {
        price = 0;
      }

      const booking = new Booking({
        workshop: workshopId,
        batch_id: bId,
        name,
        age,
        email,
        mobile_number,
        gender,
        status: 'INITIATED',
        pricing_tier,
        price_charged: price,
        paymentResult: { status: 'initiated' }
      });
      await booking.save();

      const merchantOrderId = workshopId.toString();
      const redirectUrl = `http://localhost:4044/workshop/check-status?merchantOrderId=${merchantOrderId}&bookingId=${booking._id.toString()}`;
      const priceInPaise = Math.round((price || 0) * 100);
      const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
        .merchantOrderId(merchantOrderId)
        .amount(priceInPaise)
        .redirectUrl(redirectUrl)
        .build();
      const paymentResponse = await client.pay(paymentRequest);

      results.push({ batchId: bId, booking, checkoutPageUrl: paymentResponse.redirectUrl });
    }

    // Create booking with status INITIATED (pending payment)
    const successful = results.filter(r => !r.error);
    const checkoutPageUrls = successful.map(({ batchId, checkoutPageUrl }) => ({ batchId, checkoutPageUrl }));

    return res.status(201).json({ checkoutPageUrls });

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
