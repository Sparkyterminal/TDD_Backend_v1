const axios = require('axios');
const Workshop = require('../../modals/Workshops');
const mongoose = require('mongoose');
const Booking = require('../../modals/WorkshopBooking');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const clientVersion = 1
const env = Env.PRODUCTION

const client = StandardCheckoutClient.getInstance(clientId,clientSecret,clientVersion,env)
function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
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
  
exports.bookWorkshop = async (req, res) => {
  try {
    const { workshopId, batchIds, name, age, email, mobile_number, gender } = req.body;

    // Validate required fields
    if (!workshopId || !name || !age || !email || !mobile_number || !gender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidObjectId(workshopId)) {
      return res.status(400).json({ error: 'Invalid workshopId' });
    }
    if (!Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ error: 'batchIds array is required' });
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
      'batches._id': { $in: batchIds }
    });

    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found or unavailable.' });
    }

    // Find and validate the single batch
    // validate all batchIds exist and are available
    const validBatches = [];
    for (const bId of batchIds) {
      if (!isValidObjectId(bId)) {
        return res.status(400).json({ error: 'Invalid batchId in batchIds' });
      }
      const b = workshop?.batches?.id(bId);
      if (!b || b.is_cancelled) {
        return res.status(404).json({ error: 'Selected batch not found or cancelled.' });
      }
      if (typeof b.capacity === 'number' && b.capacity <= 0) {
        return res.status(400).json({ error: 'No more slots available for one of the batches.' });
      }
      validBatches.push(b);
    }
    // At this point all batches in validBatches are available

    // Determine pricing tier based on early_bird capacity_limit vs existing bookings
    // Determine pricing per batch and sum total
    const pricingDetails = [];
    let totalPrice = 0;
    for (const b of validBatches) {
      const bId = b._id.toString();
      const earlyLimit = b.pricing?.early_bird?.capacity_limit ?? 0;
      const earlyCount = await Booking.countDocuments({ workshop: workshopId, batch_ids: { $in: [bId] }, 'pricing_details.pricing_tier': 'EARLY_BIRD' });
      let tier = 'REGULAR';
      if (earlyLimit > 0 && earlyCount < earlyLimit && b.pricing?.early_bird?.price != null) {
        tier = 'EARLY_BIRD';
      }
      let price = 0;
      if (tier === 'EARLY_BIRD') {
        price = b.pricing.early_bird.price;
      } else if (b.pricing?.regular?.price != null) {
        price = b.pricing.regular.price;
      } else if (b.pricing?.on_the_spot?.price != null) {
        tier = 'ON_THE_SPOT';
        price = b.pricing.on_the_spot.price;
      }
      totalPrice =  price;
      pricingDetails.push({ batch_id: b._id, pricing_tier: tier, price });
    }

    const booking = new Booking({
      workshop: workshopId,
      batch_ids: batchIds,
      name,
      age,
      email,
      mobile_number,
      gender,
      status: 'INITIATED',
      pricing_details: pricingDetails,
      price_charged: totalPrice,
      paymentResult: { status: 'initiated' }
    });
    await booking.save();

    const merchantOrderId = booking._id.toString();
    const redirectUrl = `https://www.thedancedistrict.in/api/workshop/check-status?merchantOrderId=${merchantOrderId}`;
    // const redirectUrl = `http://localhost:4044/workshop/check-status?merchantOrderId=${merchantOrderId}`;
    const priceInPaise = Math.round((totalPrice || 0) * 100);
    const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
      .merchantOrderId(merchantOrderId)
      .amount(priceInPaise)
      .redirectUrl(redirectUrl)
      .build();
    const paymentResponse = await client.pay(paymentRequest);

    // Create booking with status INITIATED (pending payment)
    return res.status(201).json({ checkoutPageUrl: paymentResponse.redirectUrl, bookingId: booking._id });

  } catch (error) {
    console.error('Error in booking workshop:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// exports.getStatusOfPayment = async (req, res) => {
//   try {
//     const { merchantOrderId } = req.query;

//     if (!merchantOrderId) {
//       return res.status(400).send("merchantOrderId is required");
//     }

//     // Get payment status from payment client
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     if (status === 'COMPLETED') {
//       // Fetch corresponding booking
//       const booking = await Booking.findById(merchantOrderId).lean();
//       if (!booking) {
//         return res.status(404).send("Booking submission not found");
//       }

//       let capacityOk = true;

//       // Fetch Workshop for capacity and batch verification
//       const workshopDoc = await Workshop.findById(booking.workshop).lean();

//       if (!workshopDoc || workshopDoc.is_cancelled || !workshopDoc.is_active) {
//         capacityOk = false;
//       } else {
//         const batchIds = booking.batch_ids && booking.batch_ids.length
//           ? booking.batch_ids
//           : [booking.batch_id].filter(Boolean);

//         for (const bId of batchIds) {
//           const bIdObj = new mongoose.Types.ObjectId(bId);
//           const batch = workshopDoc.batches?.find(
//             b => b._id.toString() === bIdObj.toString()
//           );

//           // Validate batch existence and status
//           if (!batch || batch.is_cancelled) {
//             capacityOk = false;
//             break;
//           }

//           // Atomically update batch capacities if possible
//           if (typeof batch.capacity === 'number') {
//             const updated = await Workshop.findOneAndUpdate(
//               { _id: booking.workshop },
//               {
//                 $inc: {
//                   'batches.$[batchCapacity].capacity': -1,
//                   'batches.$[batchEarlyBird].pricing.early_bird.capacity_limit': -1
//                 }
//               },
//               {
//                 new: true,
//                 arrayFilters: [
//                   { 'batchCapacity._id': bIdObj, 'batchCapacity.capacity': { $gt: 0 } },
//                   { 'batchEarlyBird._id': bIdObj, 'batchEarlyBird.pricing.early_bird.capacity_limit': { $gt: 0 } }
//                 ]
//               }
//             );
//             if (!updated) {
//               capacityOk = false;
//               break;
//             }
//           }
//         }
//       }

//       // If capacity update failed for any batch, mark booking payment as FAILED
//       if (!capacityOk) {
//         await Booking.findByIdAndUpdate(
//           merchantOrderId,
//           {
//             'paymentResult.status': 'FAILED',
//             'paymentResult.phonepeResponse': response,
//             status: 'FAILED'
//           }
//         );
//         // return res.redirect(`https://www.thedancedistrict.in/payment-failure`);
//         return res.redirect(`http://localhost:5173/payment-failure`);
//       }

//       // Mark booking as CONFIRMED with payment details
//       await Booking.findByIdAndUpdate(
//         merchantOrderId,
//         {
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response,
//           status: 'CONFIRMED'
//         }
//       );
//       // return res.redirect(`https://www.thedancedistrict.in/payment-success`);

//       return res.redirect(`http://localhost:5173/payment-success`);
//     } else {
//       // Payment not completed - mark FAILED
//       await Booking.findByIdAndUpdate(
//         merchantOrderId,
//         {
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response,
//           status: 'FAILED'
//         }
//       );
//       // return res.redirect(`https://www.thedancedistrict.in/payment-failure`);

//       return res.redirect(`http://localhost:5173/payment-failure`);
//     }
//   } catch (error) {
//     console.error('Error while checking payment status:', error);
//     return res.status(500).send('Internal server error during payment status check');
//   }
// };


// exports.getStatusOfPayment = async (req, res) => {
//   console.log('getStatusOfPayment invoked with query:', req.query);

//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId) {
//       return res.status(400).send("merchantOrderId is required");
//     }

//     // Retrieve payment status from your payment client
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     if (status === 'COMPLETED') {
//       // Find the booking and related workshop
//       const booking = await Booking.findById(merchantOrderId).lean();
//       if (!booking) {
//         return res.status(404).send("Booking submission not found");
//       }

//       // If batches have capacity, decrement each atomically; if not set, skip decrement
//       let capacityOk = true;
//       const workshopDoc = await Workshop.findById(booking.workshop).lean();
//       if (!workshopDoc || workshopDoc.is_cancelled === true || workshopDoc.is_active === false) {
//         capacityOk = false;
//       } else {
//         const batchIds = booking.batch_ids && booking.batch_ids.length ? booking.batch_ids : [booking.batch_id].filter(Boolean);
//         for (const bId of batchIds) {
//           const bIdObj = new mongoose.Types.ObjectId(bId);
//           const batch = workshopDoc.batches?.find(b => b._id.toString() === bIdObj.toString());
//           if (!batch || batch.is_cancelled) {
//             capacityOk = false;
//             break;
//           }
//           if (typeof batch.capacity === 'number') {
//             const updated = await Workshop.findOneAndUpdate(
//               { _id: booking.workshop },
//               { $inc: { 'batches.$[elem].capacity': -1 } },
//               { new: true, arrayFilters: [ { 'elem._id': bIdObj, 'elem.capacity': { $gt: 0 } } ] }
//             );
//             if (!updated) {
//               capacityOk = false;
//               break;
//             }
//           }
//         }
//       }

//       if (!capacityOk) {
//         await Booking.findByIdAndUpdate(
//           merchantOrderId,
//           {
//             'paymentResult.status': 'FAILED',
//             'paymentResult.phonepeResponse': response,
//             status: 'FAILED'
//           }
//         );
//         return res.redirect(`http://localhost:5173/payment-failure`);
//       }

//       // Mark booking as CONFIRMED
//       await Booking.findByIdAndUpdate(
//         merchantOrderId,
//         {
//           'paymentResult.status': 'COMPLETED',
//           'paymentResult.paymentDate': new Date(),
//           'paymentResult.phonepeResponse': response,
//           status: 'CONFIRMED'
//         }
//       );

//       return res.redirect(`http://localhost:5173/payment-success`);
//     } else {
//       await Booking.findByIdAndUpdate(
//         merchantOrderId,
//         {
//           'paymentResult.status': 'FAILED',
//           'paymentResult.phonepeResponse': response,
//           status: 'FAILED'
//         }
//       );

//       return res.redirect(`http://localhost:5173/payment-failure`);
//     }
//   } catch (error) {
//     console.error('Error while checking payment status:', error);
//     return res.status(500).send('Internal server error during payment status check');
//   }
// };


exports.getStatusOfPayment = async (req, res) => {
  console.log('getStatusOfPayment invoked with query:', req.query);

  try {
    const { merchantOrderId } = req.query;

    if (!merchantOrderId) {
      return res.status(400).send("merchantOrderId is required");
    }

    // Call PhonePe API for order status
    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;

    if (status === 'COMPLETED') {
      const booking = await Booking.findById(merchantOrderId).populate('workshop').lean();
      if (!booking) {
        return res.status(404).send("Booking not found");
      }

      let capacityOk = true;
      const workshopDoc = await Workshop.findById(booking.workshop._id).lean();

      if (!workshopDoc || workshopDoc.is_cancelled || !workshopDoc.is_active) {
        capacityOk = false;
      } else {
        for (const bId of booking.batch_ids || []) {
          const bIdObj = new mongoose.Types.ObjectId(bId);
          const batch = workshopDoc.batches?.find(b => b._id.toString() === bIdObj.toString());

          if (!batch || batch.is_cancelled) {
            capacityOk = false;
            break;
          }

          if (typeof batch.capacity === 'number') {
            const updated = await Workshop.findOneAndUpdate(
              { _id: booking.workshop._id },
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
            if (!updated) {
              capacityOk = false;
              break;
            }
          }
        }
      }

      if (!capacityOk) {
        await Booking.findByIdAndUpdate(merchantOrderId, {
          'paymentResult.status': 'FAILED',
          'paymentResult.phonepeResponse': response,
          status: 'FAILED'
        });
        return res.redirect('https://www.thedancedistrict.in/payment-failure');
        // return res.redirect(`http://localhost:5173/payment-failure`);
      }

      // Update booking on successful payment
      const updatedBooking = await Booking.findByIdAndUpdate(
        merchantOrderId,
        {
          'paymentResult.status': 'COMPLETED',
          'paymentResult.paymentDate': new Date(),
          'paymentResult.phonepeResponse': response,
          status: 'CONFIRMED'
        },
        { new: true }
      ).populate('workshop');

      console.log('Booking confirmed:', updatedBooking);

      // WhatsApp message preparation
      let mobileNumber = updatedBooking?.mobile_number?.toString().trim() || '';
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.startsWith('91') && digits.length === 12) mobileNumber = `+${digits}`;
        else if (!mobileNumber.startsWith('+')) mobileNumber = `+${digits}`;
      }

      const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';
      const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '15558600955';
      console.log('updatedBooking',updatedBooking)
      const dancerName = updatedBooking.name || 'Participant';
      const workshopTitle = updatedBooking.workshop?.title || 'Dance Workshop';
      const date = updatedBooking.workshop?.date ? new Date(updatedBooking.workshop.date).toLocaleDateString('en-GB') : 'TBA';
      const batch = updatedBooking.workshop?.batches?.find(b => updatedBooking.batch_ids.includes(b._id.toString()));
console.log('batch time', batch);

const time = batch?.start_time 
  ? new Date(batch.start_time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) 
  : 'TBA';
      const location = updatedBooking.workshop?.location || 'The Dance District Studio, Gubalaala Main Road Bengaluru';
      const contactNo = '+91 8073139244';

      const messagePayload = {
        integrated_number: '15558600955',
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "workshop_confirmation",
            language: {
              code: "en",
              policy: "deterministic"
            },
            namespace: "757345ed_855e_4856_b51f_06bc7bcfb953",
            to_and_components: [
              {
                to: [mobileNumber],
                components: {
                  body_1: { type: "text", value: dancerName },
                  body_2: { type: "text", value: workshopTitle },
                  body_3: { type: "text", value: date },
                  body_4: { type: "text", value: time },
                  body_5: { type: "text", value: location },
                  body_6: { type: "text", value: contactNo }
                }
              }
            ]
          }
        }
      };

      const apiURL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

      if (mobileNumber) {
        try {
          const axiosResponse = await axios.post(apiURL, messagePayload, {
            headers: {
              'authkey': '473576AtOfLQYl68f619aaP1',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            maxRedirects: 5
          });
          console.log('WhatsApp API bulk message response:', axiosResponse.data);
        } catch (error) {
          console.error('Failed to send WhatsApp bulk message:', error.response?.data || error.message);
        }
      } else {
        console.log('No valid mobile number available for WhatsApp message');
      }

      return res.redirect(`https://www.thedancedistrict.in/payment-success`);
      // return res.redirect(`http://localhost:5173/payment-success`);

    } else {
      await Booking.findByIdAndUpdate(merchantOrderId, {
        'paymentResult.status': 'FAILED',
        'paymentResult.phonepeResponse': response,
        status: 'FAILED'
      });
      return res.redirect(`https://www.thedancedistrict.in/payment-failure`);
      // return res.redirect(`http://localhost:5173/payment-failure`);

    }
  } catch (error) {
    console.error('Error while checking payment status:', error);
    return res.status(500).send('Internal server error during payment status check');
  }
}


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
