const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../../config');
const phonepe = require('../../services/phonepe');
const whatsapp = require('../../services/whatsapp');
const MembershipPlan = require('../../models/MembershipPlans');
const MembershipBooking = require('../../models/MembershipBooking');
const User = require('../../models/Users');
const ClassType = require('../../models/ClassTypes');
const { getInternalEmailFromPhone } = require('../../utils/functions');

// Canonical billing intervals (lowercase, matching plan.prices keys)
const VALID_INTERVALS = ['monthly', 'quarterly', 'half_yearly', 'yearly'];

// Months per interval. Legacy uppercase variants are kept for old bookings.
// Keep in sync with models/MembershipBooking (INTERVAL_TO_MONTHS / NORMALIZE_INTERVAL).
const INTERVAL_TO_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  '3_MONTHS': 3,
  '6_MONTHS': 6,
  YEARLY: 12,
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12
};

// Customers can renew from this many days before their end date (matches the WhatsApp reminder window).
const RENEWAL_WINDOW_DAYS = 30;

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function isAdminRequest(req) {
    const token = req.get('Authorization');
    const decoded = token ? jwt.decode(token) : null;
    return Boolean(decoded && decoded.role === 'ADMIN');
}

async function findUserByPhoneOrLegacyEmail(mobile_number, legacyEmail) {
    if (mobile_number) {
        const byPhone = await User.findOne({ 'phone_data.phone_number': mobile_number });
        if (byPhone) return byPhone;
    }
    if (legacyEmail) {
        return User.findOne({
            $or: [
                { 'email_data.email_id': legacyEmail },
                { 'email_data.temp_email_id': legacyEmail }
            ]
        });
    }
    return null;
}

async function createUserFromBookingDetails(booking) {
    const [firstName, ...rest] = (booking.name || 'User').trim().split(/\s+/);
    const lastName = rest.join(' ');
    const password = `${firstName || 'User'}@123`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const internalEmail = booking.email || getInternalEmailFromPhone(booking.mobile_number);
    return User.create({
        first_name: firstName || 'User',
        last_name: lastName || 'User',
        media: [],
        email_data: { temp_email_id: internalEmail, is_validated: true },
        phone_data: { phone_number: booking.mobile_number, is_validated: true },
        role: 'USER',
        password: hashedPassword,
        is_active: true,
        is_archived: false
    });
}

function pick(obj, allowed) {
    const out = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            out[key] = obj[key];
        }
    }
    return out;
}

// Normalize billing_interval to canonical lowercase (matches plan.prices keys)
function normalizeBillingInterval(val) {
    if (!val || typeof val !== 'string') return val;
    const map = {
        monthly: 'monthly', MONTHLY: 'monthly',
        quarterly: 'quarterly', QUARTERLY: 'quarterly', '3_MONTHS': 'quarterly', '3_months': 'quarterly',
        half_yearly: 'half_yearly', HALF_YEARLY: 'half_yearly', '6_MONTHS': 'half_yearly', '6_months': 'half_yearly',
        yearly: 'yearly', YEARLY: 'yearly'
    };
    return map[val] || val;
}

exports.createPlan = async (req, res) => {
    try {
        const { 
            name, description, dance_type, prices, benefits, is_active, 
            plan_for, kids_category, image, batches 
        } = req.body;

        if (!dance_type || !isValidObjectId(dance_type)) {
            return res.status(400).json({ error: 'Valid dance_type is required' });
        }
        const classType = await ClassType.findById(dance_type).lean();
        if (!classType) {
            return res.status(404).json({ error: 'Dance type not found' });
        }

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Valid name is required' });
        }
        if (!prices || typeof prices !== 'object') {
            return res.status(400).json({ error: 'Valid prices object is required' });
        }
        if (prices.monthly === undefined || typeof prices.monthly !== 'number' || prices.monthly < 0) {
            return res.status(400).json({ error: 'Valid monthly price is required' });
        }
        const optionalPrices = ['quarterly', 'half_yearly', 'yearly'];
        for (const priceType of optionalPrices) {
            if (prices[priceType] !== undefined && (typeof prices[priceType] !== 'number' || prices[priceType] < 0)) {
                return res.status(400).json({ error: `Valid ${priceType} price is required` });
            }
        }

        if (benefits && !Array.isArray(benefits)) {
            return res.status(400).json({ error: 'benefits must be an array of strings' });
        }
        if (image && !isValidObjectId(image)) {
            return res.status(400).json({ error: 'Invalid image ID' });
        }
        if (batches && !Array.isArray(batches)) {
            return res.status(400).json({ error: 'batches must be an array' });
        }

        if (batches && batches.length > 0) {
            const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

            for (const batch of batches) {
                if (!batch.schedule || !Array.isArray(batch.schedule) || batch.schedule.length === 0) {
                    return res.status(400).json({ error: 'Each batch must have a schedule array with at least one day-time entry' });
                }

                for (const sched of batch.schedule) {
                    if (!sched.day || !validDays.includes(sched.day)) {
                        return res.status(400).json({ error: `Invalid day in schedule: ${sched.day}` });
                    }
                    if (!sched.start_time || !sched.end_time) {
                        return res.status(400).json({ error: 'Each schedule entry must have start_time and end_time' });
                    }
                    if (!timeRegex.test(sched.start_time) || !timeRegex.test(sched.end_time)) {
                        return res.status(400).json({ error: 'Time must be in HH:MM format' });
                    }
                    if (sched.start_time >= sched.end_time) {
                        return res.status(400).json({ error: 'Schedule start_time must be before end_time' });
                    }
                }

                if (batch.capacity !== undefined && (typeof batch.capacity !== 'number' || batch.capacity < 0)) {
                    return res.status(400).json({ error: 'Batch capacity must be a non-negative number' });
                }
            }
        }

        if (plan_for !== undefined) {
            const allowedAudiences = ['KID', 'KIDS', 'ADULT'];
            if (!allowedAudiences.includes(plan_for)) {
                return res.status(400).json({ error: 'Invalid plan_for' });
            }
        }
        if ((plan_for === 'KID' || plan_for === 'KIDS') && (!kids_category || !['JUNIOR', 'ADVANCED'].includes(kids_category))) {
            return res.status(400).json({ error: 'Kids category is required for KID/KIDS plans and must be JUNIOR or ADVANCED' });
        }
        if (plan_for === 'ADULT' && kids_category) {
            return res.status(400).json({ error: 'Kids category should not be provided for ADULT plans' });
        }

        const plan = await MembershipPlan.create({
            name,
            description,
            dance_type: classType._id,
            prices,
            benefits: benefits || [],
            plan_for: plan_for || 'ADULT',
            kids_category: (plan_for === 'KID' || plan_for === 'KIDS') ? kids_category : undefined,
            is_active: is_active !== undefined ? !!is_active : true,
            image: image || undefined,
            batches: batches || []
        });

        return res.status(201).json(plan);
    } catch (err) {
        console.error('Create membership plan error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
exports.getPlans = async (req, res) => {
    try {
        const {
            page = '1',
            limit = '20',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            is_active,
            interval,
            q,
            plan_for,
            subcategory,
            classTypeId
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const allowedSortFields = new Set(['createdAt', 'updatedAt', 'name', 'price']);
        const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

        const filter = {};
        if (is_active !== undefined) {
            if (is_active === 'true' || is_active === true) filter.is_active = true;
            else if (is_active === 'false' || is_active === false) filter.is_active = false;
        }
        if (interval) {
            const intervals = ['MONTHLY', '3_MONTHS', '6_MONTHS', 'YEARLY'];
            if (intervals.includes(interval)) filter.billing_interval = interval;
        }
        if (plan_for) {
            const allowedAudiences = ['KID', 'KIDS', 'ADULT'];
            if (allowedAudiences.includes(plan_for)) filter.plan_for = plan_for;
        }
        if (subcategory) {
            const allowedSubcategories = ['JUNIOR', 'ADVANCED'];
            if (allowedSubcategories.includes(subcategory)) filter.kids_category = subcategory;
        }
        if (q && typeof q === 'string' && q.trim()) {
            const pattern = new RegExp(q.trim(), 'i');
            filter.$or = [{ name: pattern }, { description: pattern }];
        }
        if (classTypeId && isValidObjectId(classTypeId)) {
            filter.dance_type = classTypeId;
        }

        const [items, total] = await Promise.all([
            MembershipPlan.find(filter)
                .populate('dance_type')
                .populate('image')
                .sort({ [sortField]: sortDir })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            MembershipPlan.countDocuments(filter)
        ]);

        return res.json({
            items,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        console.error('Get membership plans error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }
        const plan = await MembershipPlan.findById(id).populate('dance_type').populate('image').lean();
        if (!plan) {
            return res.status(404).json({ error: 'Membership plan not found' });
        }
        return res.json(plan);
    } catch (err) {
        console.error('Get membership plan error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }

        const allowed = ['name', 'description', 'prices', 'benefits', 'is_active', 'plan_for', 'kids_category', 'dance_type', 'image', 'batches'];
        const updateData = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updateData[key] = req.body[key];
            }
        }

        if (updateData.prices !== undefined) {
            if (typeof updateData.prices !== 'object') {
                return res.status(400).json({ error: 'Invalid prices object' });
            }
            if (updateData.prices.monthly !== undefined && (typeof updateData.prices.monthly !== 'number' || updateData.prices.monthly < 0)) {
                return res.status(400).json({ error: 'Valid monthly price is required' });
            }
            const optionalPrices = ['quarterly', 'half_yearly', 'yearly'];
            for (const priceType of optionalPrices) {
                if (updateData.prices[priceType] !== undefined && (typeof updateData.prices[priceType] !== 'number' || updateData.prices[priceType] < 0)) {
                    return res.status(400).json({ error: `Valid ${priceType} price is required` });
                }
            }
        }
        if (updateData.benefits !== undefined && !Array.isArray(updateData.benefits)) {
            return res.status(400).json({ error: 'benefits must be an array' });
        }
        if (updateData.plan_for !== undefined) {
            const allowedAudiences = ['KID', 'KIDS', 'ADULT'];
            if (!allowedAudiences.includes(updateData.plan_for)) {
                return res.status(400).json({ error: 'Invalid plan_for' });
            }
        }
        if ((updateData.plan_for === 'KID' || updateData.plan_for === 'KIDS') && (!updateData.kids_category || !['JUNIOR', 'ADVANCED'].includes(updateData.kids_category))) {
            return res.status(400).json({ error: 'Kids category is required for KID/KIDS plans and must be JUNIOR or ADVANCED' });
        }
        if (updateData.plan_for === 'ADULT' && updateData.kids_category) {
            return res.status(400).json({ error: 'Kids category should not be provided for ADULT plans' });
        }
        if (updateData.dance_type !== undefined) {
            if (!isValidObjectId(updateData.dance_type)) {
                return res.status(400).json({ error: 'Invalid dance_type ID' });
            }
            const classType = await ClassType.findById(updateData.dance_type).lean();
            if (!classType) {
                return res.status(404).json({ error: 'Dance type not found' });
            }
        }
        if (updateData.image !== undefined) {
            if (updateData.image && !isValidObjectId(updateData.image)) {
                return res.status(400).json({ error: 'Invalid image ID' });
            }
        }
        if (updateData.batches !== undefined) {
            if (!Array.isArray(updateData.batches)) {
                return res.status(400).json({ error: 'batches must be an array' });
            }
            const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            for (const batch of updateData.batches) {
                if (!batch.schedule || !Array.isArray(batch.schedule) || batch.schedule.length === 0) {
                    return res.status(400).json({ error: 'Each batch must have a schedule array with at least one day/time entry' });
                }
                for (const sched of batch.schedule) {
                    if (!sched.day || !validDays.includes(sched.day)) {
                        return res.status(400).json({ error: `Invalid day: ${sched.day}` });
                    }
                    if (!sched.start_time || !sched.end_time) {
                        return res.status(400).json({ error: 'Each schedule entry must have start_time and end_time' });
                    }
                    if (!timeRegex.test(sched.start_time) || !timeRegex.test(sched.end_time)) {
                        return res.status(400).json({ error: 'Time must be in HH:MM format' });
                    }
                    if (sched.start_time >= sched.end_time) {
                        return res.status(400).json({ error: 'Schedule start_time must be before end_time' });
                    }
                }
                if (batch.capacity !== undefined && (typeof batch.capacity !== 'number' || batch.capacity < 0)) {
                    return res.status(400).json({ error: 'Batch capacity must be a non-negative number' });
                }
            }
        }

        const updated = await MembershipPlan.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('dance_type').populate('image');
        if (!updated) {
            return res.status(404).json({ error: 'Membership plan not found' });
        }
        return res.json(updated);
    } catch (err) {
        console.error('Update membership plan error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid plan ID' });
        }

        const deleted = await MembershipPlan.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Membership plan not found' });
        }
        return res.json({ message: 'Membership plan deleted successfully' });
    } catch (err) {
        console.error('Delete membership plan error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};


// Public: start a membership booking and return the PhonePe checkout URL.
exports.createBooking = async (req, res) => {
    try {
      const {
        planId,
        batch_id,
        billing_interval,
        name,
        age,
        mobile_number,
        gender
      } = req.body;

      if (!isValidObjectId(planId))
        return res.status(400).json({ error: 'Invalid planId' });
      if (!isValidObjectId(batch_id))
        return res.status(400).json({ error: 'Invalid batch_id' });
      if (!billing_interval || !VALID_INTERVALS.includes(billing_interval))
        return res.status(400).json({ error: 'Invalid billing_interval' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'Valid name is required' });
      if (typeof age !== 'number' || age < 0)
        return res.status(400).json({ error: 'Valid age is required' });
      if (!mobile_number || typeof mobile_number !== 'string')
        return res.status(400).json({ error: 'Valid mobile_number is required' });
      if (!gender || !['Male', 'Female', 'Other'].includes(gender))
        return res.status(400).json({ error: 'Valid gender is required' });

      const plan = await MembershipPlan.findById(planId);
      if (!plan || !plan.is_active)
        return res.status(404).json({ error: 'Plan not found or inactive' });
      const batch = plan.batches.id(batch_id);
      if (!batch)
        return res.status(400).json({ error: 'Batch not found in plan' });
      if (batch.capacity !== undefined && batch.capacity <= 0)
        return res.status(400).json({ error: 'Batch full' });

      const normalizedInterval = normalizeBillingInterval(billing_interval);
      const price = plan.prices?.[normalizedInterval];
      if (price === undefined || price === null || price < 0)
        return res.status(400).json({ error: `Invalid price for ${billing_interval}` });

      // First booking pays the plan price + one-time registration fee
      const totalPrice = price + config.fees.membershipRegistration;

      const booking = await MembershipBooking.create({
        plan: plan._id,
        batchId: batch._id,
        billing_interval: normalizedInterval,
        name,
        age,
        email: getInternalEmailFromPhone(mobile_number),
        mobile_number,
        gender,
        paymentResult: { status: 'initiated' }
        // user is set in checkMembershipStatus once payment succeeds
      });

      // Initial bookings use the booking _id as merchantOrderId
      const checkoutPageUrl = await phonepe.createCheckout({
        merchantOrderId: booking._id.toString(),
        amountInRupees: totalPrice,
        statusPath: 'membership-plan/check-status'
      });

      res.status(201).json({
        message: 'Booking initiated, complete payment.',
        booking,
        checkoutPageUrl
      });
    } catch (err) {
      console.error('createBooking:', err);
      res.status(500).json({ error: 'Server error' });
    }
  };

/** Atomically take one seat in a plan batch (only for batches that have a capacity). */
async function decrementPlanBatchSeat(planId, batchId) {
  if (!planId || !batchId) return;
  await MembershipPlan.updateOne(
    { _id: planId },
    { $inc: { 'batches.$[b].capacity': -1 } },
    { arrayFilters: [{ 'b._id': new mongoose.Types.ObjectId(String(batchId)), 'b.capacity': { $gt: 0 } }] }
  );
}

// Public: PhonePe redirects the customer's browser here after payment.
// merchantOrderId is the booking _id for first bookings, and ORDER_<timestamp>_<bookingId> for renewals.
exports.checkMembershipStatus = async (req, res) => {
    try {
      const { merchantOrderId } = req.query;
      if (!merchantOrderId) return res.status(400).send('merchantOrderId is required');

      let bookingId = merchantOrderId;
      if (!isValidObjectId(merchantOrderId)) {
        const parts = String(merchantOrderId).split('_');
        bookingId = parts[parts.length - 1];
      }
      if (!isValidObjectId(bookingId)) {
        return res.status(400).send('Invalid booking ID parsed from merchantOrderId');
      }
      const isRenewal = String(merchantOrderId) !== String(bookingId);

      const booking = await MembershipBooking.findById(bookingId).lean();
      if (!booking) return res.status(404).send('Booking not found');

      // Already applied (page refresh / back button): do nothing twice.
      if (booking.paymentResult?.processed_order_id === merchantOrderId) {
        return res.redirect(config.urls.paymentSuccess);
      }

      let state = 'unknown';
      let phonepeResponse = {};
      try {
        phonepeResponse = await phonepe.getOrderStatus(merchantOrderId);
        state = phonepeResponse.state;
      } catch (gatewayErr) {
        console.error('PhonePe gateway status error:', gatewayErr);
      }

      const pendingRenewal =
        isRenewal && booking.pending_renewal?.merchant_order_id === merchantOrderId ? booking.pending_renewal : null;

      if (state !== 'COMPLETED') {
        if (pendingRenewal) {
          // Failed/abandoned renewal: keep the current membership exactly as it is.
          await MembershipBooking.findByIdAndUpdate(bookingId, { $unset: { pending_renewal: 1 } });
        } else {
          await MembershipBooking.findByIdAndUpdate(bookingId, {
            'paymentResult.status': 'FAILED',
            'paymentResult.phonepeResponse': phonepeResponse
          });
        }
        return res.redirect(config.urls.paymentFailure);
      }

      // Claim this order so concurrent/repeated requests cannot apply it twice.
      const claimed = await MembershipBooking.findOneAndUpdate(
        { _id: bookingId, 'paymentResult.processed_order_id': { $ne: merchantOrderId } },
        { $set: { 'paymentResult.processed_order_id': merchantOrderId } },
        { new: true }
      ).lean();
      if (!claimed) return res.redirect(config.urls.paymentSuccess);

      try {
        const now = new Date();
        let planId = claimed.plan;
        let batchId = claimed.batchId;
        let interval = normalizeBillingInterval(claimed.billing_interval);
        let startDate;
        let endDate;

        if (isRenewal) {
          if (pendingRenewal) {
            planId = pendingRenewal.plan || planId;
            batchId = pendingRenewal.batchId || batchId;
            interval = normalizeBillingInterval(pendingRenewal.billing_interval || interval);
          }
          const months = INTERVAL_TO_MONTHS[interval] || 1;
          // Early renewals extend from the current end date; expired memberships restart today.
          startDate = claimed.end_date && new Date(claimed.end_date) > now ? new Date(claimed.end_date) : now;
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + months);

          await MembershipBooking.findByIdAndUpdate(bookingId, {
            $set: {
              plan: planId,
              batchId,
              billing_interval: interval,
              // start_date is never changed on renewal
              end_date: endDate,
              renewal_date: now,
              'paymentResult.status': 'COMPLETED',
              'paymentResult.paymentDate': now,
              'paymentResult.phonepeResponse': phonepeResponse
            },
            $unset: { pending_renewal: 1 }
          });
        } else {
          let user = claimed.user ? await User.findById(claimed.user) : null;
          if (!user) user = await findUserByPhoneOrLegacyEmail(claimed.mobile_number, claimed.email);
          if (!user) user = await createUserFromBookingDetails(claimed);

          startDate = claimed.start_date ? new Date(claimed.start_date) : now;
          if (claimed.end_date) {
            endDate = new Date(claimed.end_date);
          } else {
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + (INTERVAL_TO_MONTHS[interval] || 1));
          }

          await MembershipBooking.findByIdAndUpdate(bookingId, {
            $set: {
              user: user._id,
              'paymentResult.status': 'COMPLETED',
              'paymentResult.paymentDate': now,
              'paymentResult.phonepeResponse': phonepeResponse,
              // For the initial booking, renewal_date equals start_date
              renewal_date: claimed.start_date || now
            }
          });
        }

        await decrementPlanBatchSeat(planId, batchId);

        // WhatsApp confirmation (failures are logged; the payment is already recorded)
        try {
          const planDoc = await MembershipPlan.findById(planId).select('name').lean();
          await whatsapp.sendMembershipConfirmation({
            mobileNumber: claimed.mobile_number,
            name: claimed.name,
            planName: planDoc?.name,
            startDate,
            expiryDate: endDate
          });
        } catch (whatsappError) {
          console.error('Whatsapp error:', whatsappError.response?.data || whatsappError.message);
        }

        return res.redirect(config.urls.paymentSuccess);
      } catch (applyErr) {
        // Release the claim so the customer can retry by reloading the page.
        await MembershipBooking.findByIdAndUpdate(bookingId, { $unset: { 'paymentResult.processed_order_id': 1 } });
        throw applyErr;
      }
    } catch (err) {
      console.error('checkMembershipStatus:', err);
      return res.status(500).send('Internal server error');
    }
  };


exports.getUserMemberships = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const {
            page = '1',
            limit = '20',
            sortBy = 'start_date',
            sortOrder = 'desc',
            active // 'true' | 'false' optional
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const filter = { user: userId };
        if (active === 'true') {
            filter.end_date = { $gt: new Date() };
        } else if (active === 'false') {
            filter.end_date = { $lte: new Date() };
        }

        const allowedSortFields = new Set(['start_date', 'end_date', 'createdAt']);
        const sortField = allowedSortFields.has(sortBy) ? sortBy : 'start_date';

        const [items, total] = await Promise.all([
            MembershipBooking.find(filter)
                .populate('plan')
                .sort({ [sortField]: sortDir })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            MembershipBooking.countDocuments(filter)
        ]);

        return res.status(200).json({
            items,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        console.error('Get user memberships error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}

// Admin: list membership bookings with filters/pagination
exports.getMembershipBookings = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            page = '1',
            limit = '20',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status, // paymentResult.status
            planId,
            userId,
            email,
            q
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const match = {};
        if (status) {
            match['paymentResult.status'] = status;
        }
        if (planId && mongoose.Types.ObjectId.isValid(planId)) {
            match.plan = new mongoose.Types.ObjectId(planId);
        }
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            match.user = new mongoose.Types.ObjectId(userId);
        }
        if (email && typeof email === 'string' && email.trim()) {
            match.email = email.trim().toLowerCase();
        }

        const allowedSortFields = new Set(['createdAt', 'updatedAt', 'start_date', 'end_date']);
        const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';

        const pipeline = [
            { $match: match },
            { $lookup: { from: 'membershipplans', localField: 'plan', foreignField: '_id', as: 'plan' } },
            { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ];

        if (q && typeof q === 'string' && q.trim()) {
            const regex = new RegExp(q.trim(), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { name: regex },
                        { email: regex },
                        { mobile_number: regex },
                        { 'plan.name': regex },
                    ]
                }
            });
        }

        pipeline.push(
            { $sort: { [sortField]: sortDir } },
            {
                $facet: {
                    items: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum },
                        { $project: { password: 0, 'user.password': 0 } }
                    ],
                    totalCount: [ { $count: 'count' } ]
                }
            }
        );

        const result = await MembershipBooking.aggregate(pipeline);
        const items = result?.[0]?.items || [];
        const total = result?.[0]?.totalCount?.[0]?.count || 0;

        return res.json({
            items,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        console.error('List membership bookings error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};


// Public: a member renews (reached from the WhatsApp renewal link /renewalform/<bookingId>).
// Nothing on the booking changes until PhonePe confirms payment (see checkMembershipStatus).
exports.renewMembership = async (req, res) => {
  try {
    const { membershipBookingId } = req.params;
    const { planId, batchId, billing_interval, billingInterval } = req.body;

    const interval = normalizeBillingInterval(String(billingInterval || billing_interval || 'monthly').toLowerCase());
    if (!VALID_INTERVALS.includes(interval)) {
      return res.status(400).json({ error: 'Invalid billing_interval provided' });
    }
    if (!isValidObjectId(membershipBookingId)) {
      return res.status(400).json({ error: 'Invalid membership booking ID' });
    }
    if (!planId || !isValidObjectId(planId)) {
      return res.status(400).json({ error: 'Valid planId is required' });
    }
    if (!batchId || !isValidObjectId(batchId)) {
      return res.status(400).json({ error: 'Valid batchId is required' });
    }

    const existingBooking = await MembershipBooking.findById(membershipBookingId).lean();
    if (!existingBooking) {
      return res.status(404).json({ error: 'Membership booking not found' });
    }

    // Renewal opens RENEWAL_WINDOW_DAYS before the end date (same window as the WhatsApp reminders).
    const renewalOpensAt = new Date();
    renewalOpensAt.setDate(renewalOpensAt.getDate() + RENEWAL_WINDOW_DAYS);
    if (existingBooking.end_date && new Date(existingBooking.end_date) > renewalOpensAt) {
      return res.status(400).json({ error: 'Membership is not due for renewal yet' });
    }

    const newPlan = await MembershipPlan.findById(planId).lean();
    if (!newPlan || !newPlan.is_active) {
      return res.status(404).json({ error: 'Membership plan not found or inactive' });
    }
    const batch = newPlan.batches.find(b => b._id.toString() === String(batchId));
    if (!batch) {
      return res.status(400).json({ error: 'Selected batch not found in the membership plan' });
    }
    if (batch.capacity !== undefined && batch.capacity <= 0) {
      return res.status(400).json({ error: 'Selected batch is full' });
    }

    const price = newPlan.prices?.[interval];
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: `This plan has no ${interval.replace('_', '-')} price` });
    }

    // The member is always derived from the booking itself, never from the request body.
    let userId = existingBooking.user;
    if (!userId) {
      let user = await findUserByPhoneOrLegacyEmail(existingBooking.mobile_number, existingBooking.email);
      if (!user) user = await createUserFromBookingDetails(existingBooking);
      userId = user._id;
    }

    const merchantOrderId = `ORDER_${Date.now()}_${existingBooking._id}`;
    const renewalBooking = await MembershipBooking.findByIdAndUpdate(
      membershipBookingId,
      {
        $set: {
          user: userId,
          pending_renewal: {
            plan: newPlan._id,
            batchId: batch._id,
            billing_interval: interval,
            merchant_order_id: merchantOrderId,
            requested_at: new Date()
          }
        }
      },
      { new: true }
    );

    const checkoutPageUrl = await phonepe.createCheckout({
      merchantOrderId,
      amountInRupees: price,
      statusPath: 'membership-plan/check-status'
    });

    return res.status(201).json({
      message: 'Membership renewal initiated. Please complete payment.',
      renewalBooking,
      checkoutPageUrl
    });
  } catch (err) {
    console.error('Renew membership error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};


  exports.getConfirmedMembershipBookings = async (req, res) => {
    try {
      const { planId, batchId } = req.params;
      const { status, discontinued, includeOrphaned } = req.query;
  
      if (!isValidObjectId(planId)) {
        return res.status(400).json({ error: 'Invalid planId' });
      }
  
      if (!isValidObjectId(batchId)) {
        return res.status(400).json({ error: 'Invalid batchId' });
      }
  
      // Build filter
      const filter = {
        plan: planId,
        batchId: batchId
      };
      
      // Filter by payment status if provided
      if (status) {
        filter['paymentResult.status'] = status;
      }
      
      // Filter by discontinued status if provided
      if (discontinued !== undefined && discontinued !== null && discontinued !== '') {
        const isDiscontinued = discontinued === 'true' || discontinued === true;
        filter.discontinued = isDiscontinued;
      }
  
      const bookings = await MembershipBooking.find(filter)
        .populate('user')
        .populate('plan')
        .sort({ createdAt: -1 });

      // Check if the batchId exists in the plan's current batches
      let isOrphanedBatch = false;
      let batchInfo = null;
      if (bookings.length > 0 && bookings[0].plan) {
        const plan = bookings[0].plan;
        const batch = plan.batches?.find(b => b._id.toString() === batchId);
        if (batch) {
          batchInfo = batch;
        } else {
          isOrphanedBatch = true;
        }
      }
  
      // Calculate end_date if not set, based on BOOKING'S billing_interval (not plan's)
      const bookingsWithCalculatedEndDate = bookings.map(booking => {
        const bookingObj = booking.toObject ? booking.toObject() : booking;
        
        if (!bookingObj.end_date && bookingObj.billing_interval) {
          const start = bookingObj.start_date ? new Date(bookingObj.start_date) : new Date();
          // Handle both uppercase and lowercase billing intervals
          const interval = bookingObj.billing_interval.toUpperCase();
          const monthsToAdd = INTERVAL_TO_MONTHS[interval] || INTERVAL_TO_MONTHS[bookingObj.billing_interval] || 0;
          const calculatedEndDate = new Date(start);
          calculatedEndDate.setMonth(calculatedEndDate.getMonth() + monthsToAdd);
          bookingObj.end_date = calculatedEndDate;
        }
        return bookingObj;
      });
  
      return res.status(200).json({ 
        confirmedMembershipBookings: bookingsWithCalculatedEndDate,
        total: bookingsWithCalculatedEndDate.length,
        batchInfo: batchInfo,
        isOrphanedBatch: isOrphanedBatch,
        message: isOrphanedBatch ? 'Warning: This batch no longer exists in the plan. These are legacy bookings.' : null
      });
    } catch (error) {
      console.error('Error fetching confirmed membership bookings:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  exports.getAdminBookingSummary = async (req, res) => {
    try {
      const { status, discontinued, planId } = req.query;
      
      // Build initial match filter
      const matchFilter = {};
      
      if (status) {
        matchFilter['paymentResult.status'] = status;
      }
      
      if (discontinued !== undefined && discontinued !== null && discontinued !== '') {
        const isDiscontinued = discontinued === 'true' || discontinued === true;
        matchFilter.discontinued = isDiscontinued;
      }
      
      if (planId && isValidObjectId(planId)) {
        matchFilter.plan = new mongoose.Types.ObjectId(planId);
      }
  
      // Get bookings grouped by batchId with enriched data
      // Also check if the batchId exists in the plan's batches array
      const batches = await MembershipBooking.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: 'membershipplans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planInfo'
          }
        },
        { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
        {
          // Check if batchId exists in planInfo.batches array
          $addFields: {
            batchInfo: {
              $filter: {
                input: { $ifNull: ['$planInfo.batches', []] },
                as: 'batch',
                cond: { $eq: ['$$batch._id', '$batchId'] }
              }
            }
          }
        },
        {
          $addFields: {
            batchDetails: { $arrayElemAt: ['$batchInfo', 0] },
            isOrphanedBatch: { 
              $eq: [{ $size: { $ifNull: ['$batchInfo', []] } }, 0] 
            }
          }
        },
        {
          $group: {
            _id: '$batchId',
            planId: { $first: '$plan' },
            planName: { $first: '$planInfo.name' },
            planFor: { $first: '$planInfo.plan_for' },
            batchSchedule: { $first: '$batchDetails.schedule' },
            batchCapacity: { $first: '$batchDetails.capacity' },
            isOrphanedBatch: { $first: '$isOrphanedBatch' },
            count: { $sum: 1 },
            bookings: { 
              $push: {
                _id: '$_id',
                name: '$name',
                email: '$email',
                mobile_number: '$mobile_number',
                age: '$age',
                gender: '$gender',
                billing_interval: '$billing_interval',
                start_date: '$start_date',
                end_date: '$end_date',
                discontinued: '$discontinued',
                paymentStatus: '$paymentResult.status',
                createdAt: '$createdAt',
                userId: '$user',
                userInfo: {
                  first_name: '$userInfo.first_name',
                  last_name: '$userInfo.last_name'
                }
              }
            }
          }
        },
        { $sort: { planName: 1, count: -1 } }
      ]);

      // Separate active and orphaned batches for clarity
      const activeBatches = batches.filter(b => !b.isOrphanedBatch);
      const orphanedBatches = batches.filter(b => b.isOrphanedBatch);
  
      // Get bookings grouped by membership plan name
      const memberships = await MembershipBooking.aggregate([
        { $match: matchFilter },
        {
          $lookup: {
            from: 'membershipplans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planInfo'
          }
        },
        { $unwind: '$planInfo' },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$planInfo._id',
            planName: { $first: '$planInfo.name' },
            planFor: { $first: '$planInfo.plan_for' },
            currentBatches: { $first: '$planInfo.batches' },
            count: { $sum: 1 },
            bookings: { 
              $push: {
                _id: '$_id',
                batchId: '$batchId',
                name: '$name',
                email: '$email',
                mobile_number: '$mobile_number',
                billing_interval: '$billing_interval',
                start_date: '$start_date',
                end_date: '$end_date',
                discontinued: '$discontinued',
                paymentStatus: '$paymentResult.status',
                userId: '$user',
                userInfo: {
                  first_name: '$userInfo.first_name',
                  last_name: '$userInfo.last_name'
                }
              }
            }
          }
        },
        { $sort: { planName: 1 } }
      ]);
  
      res.json({
        batches: activeBatches,
        orphanedBatches: orphanedBatches,
        memberships,
        summary: {
          totalActiveBatches: activeBatches.length,
          totalOrphanedBatches: orphanedBatches.length,
          totalPlans: memberships.length,
          totalBookings: batches.reduce((sum, b) => sum + b.count, 0),
          orphanedBookingsCount: orphanedBatches.reduce((sum, b) => sum + b.count, 0)
        }
      });
    } catch (error) {
      console.error('Error in getAdminBookingSummary:', error);
      res.status(500).json({ error: error.message });
    }
  };


exports.getAllMembershipBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, planId, userId, batchId, search, discontinued, renewalEligible } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const userLookupProject = {
      first_name: 1,
      last_name: 1,
      email_data: 1,
      phone_data: 1
    };
    if (isAdminRequest(req)) {
      userLookupProject.admin_remarks = 1;
    }

    // Build match filter for aggregation
    const matchFilter = {};
    
    if (status) {
      matchFilter['paymentResult.status'] = status;
    }
    
    if (planId && isValidObjectId(planId)) {
      matchFilter.plan = new mongoose.Types.ObjectId(planId);
    }
    
    if (userId && isValidObjectId(userId)) {
      matchFilter.user = new mongoose.Types.ObjectId(userId);
    }
    
    if (batchId && isValidObjectId(batchId)) {
      matchFilter.batchId = new mongoose.Types.ObjectId(batchId);
    }

    // Note: discontinued filter will be applied after initial match to avoid conflicts
    let discontinuedFilter = null;
    if (discontinued !== undefined && discontinued !== null && discontinued !== '') {
      const isDiscontinued = discontinued === 'true' || discontinued === true || discontinued === 'yes';
      discontinuedFilter = isDiscontinued;
    }

    // Aggregation pipeline
    const pipeline = [
      // Match stage - initial filters
      { $match: matchFilter },
      
      // Lookup user data FIRST
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            {
              $project: userLookupProject
            }
          ]
        }
      },
      
      // Lookup plan data
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData',
          pipeline: [
            {
              $project: {
                name: 1,
                price: 1,
                billing_interval: 1,
                plan_for: 1
              }
            }
          ]
        }
      },
      
      // Lookup batch data (optional, if you want to show batch info)
      {
        $lookup: {
          from: 'batches', // or whatever your batch collection name is
          localField: 'batchId',
          foreignField: '_id',
          as: 'batchData',
          pipeline: [
            {
              $project: {
                name: 1,
                timings: 1
              }
            }
          ]
        }
      },
      
      // Add fields to reshape the data
      {
        $addFields: {
          userInfo: { $arrayElemAt: ['$userData', 0] },
          planInfo: { $arrayElemAt: ['$planData', 0] },
          batchInfo: { $arrayElemAt: ['$batchData', 0] }
        }
      },
      
      // Remove the temporary arrays
      {
        $unset: ['userData', 'planData', 'batchData']
      }
    ];

    // Apply discontinued filter after data reshaping
    if (discontinuedFilter !== null) {
      if (discontinuedFilter === true) {
        // Filter for discontinued bookings
        pipeline.push({
          $match: {
            $or: [
              { discontinued: true },
              { discontinued: 'true' }
            ]
          }
        });
      } else {
        // Filter for active (non-discontinued) bookings
        pipeline.push({
          $match: {
            $or: [
              { discontinued: { $exists: false } },
              { discontinued: false },
              { discontinued: 'false' },
              { discontinued: null }
            ]
          }
        });
      }
    }

    // Add calculated field for renewal eligibility
    // First, calculate effective end_date (use end_date if exists, otherwise calculate from renewal_date/start_date + billing_interval)
    // Then check if it's within 2 days from today (including past dates up to 2 days ago, today, and up to 2 days ahead)
    pipeline.push({
      $addFields: {
        // Calculate effective end date
        effectiveEndDate: {
          $cond: {
            if: {
              $and: [
                { $ne: ['$end_date', null] },
                { $ne: ['$end_date', undefined] },
                { $eq: [{ $type: '$end_date' }, 'date'] }
              ]
            },
            then: '$end_date',
            else: {
              // Calculate from renewal_date or start_date + billing_interval
              $cond: {
                if: {
                  $and: [
                    { $or: [
                      { $and: [{ $ne: ['$renewal_date', null] }, { $ne: ['$renewal_date', undefined] }] },
                      { $and: [{ $ne: ['$start_date', null] }, { $ne: ['$start_date', undefined] }] }
                    ]},
                    { $ne: ['$billing_interval', null] },
                    { $ne: ['$billing_interval', undefined] }
                  ]
                },
                then: {
                  $let: {
                    vars: {
                      baseDate: {
                        $cond: {
                          if: { $and: [{ $ne: ['$renewal_date', null] }, { $ne: ['$renewal_date', undefined] }] },
                          then: '$renewal_date',
                          else: '$start_date'
                        }
                      },
                      interval: '$billing_interval'
                    },
                    in: {
                      $dateAdd: {
                        startDate: '$$baseDate',
                        unit: {
                          $switch: {
                            branches: [
                              { case: { $in: ['$$interval', ['monthly', 'MONTHLY']] }, then: 'month' },
                              { case: { $in: ['$$interval', ['quarterly', 'QUARTERLY', '3_MONTHS']] }, then: 'month' },
                              { case: { $in: ['$$interval', ['half_yearly', 'HALF_YEARLY', '6_MONTHS']] }, then: 'month' },
                              { case: { $in: ['$$interval', ['yearly', 'YEARLY']] }, then: 'year' }
                            ],
                            default: 'month'
                          }
                        },
                        amount: {
                          $switch: {
                            branches: [
                              { case: { $in: ['$$interval', ['monthly', 'MONTHLY']] }, then: 1 },
                              { case: { $in: ['$$interval', ['quarterly', 'QUARTERLY', '3_MONTHS']] }, then: 3 },
                              { case: { $in: ['$$interval', ['half_yearly', 'HALF_YEARLY', '6_MONTHS']] }, then: 6 },
                              { case: { $in: ['$$interval', ['yearly', 'YEARLY']] }, then: 12 }
                            ],
                            default: 1
                          }
                        }
                      }
                    }
                  }
                },
                else: null
              }
            }
          }
        }
      }
    });

    // Now calculate renewal eligibility based on effective end date
    // Frontend logic: Renew button is enabled when:
    // 1. Payment status is NOT "COMPLETED" - always enabled
    // 2. Payment status IS "COMPLETED" - enabled only if isRenewalEnabled returns true
    //    isRenewalEnabled: diffDays = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24)); return diffDays <= 2
    // 3. Must have an effective end date
    pipeline.push({
      $addFields: {
        renewalEligible: {
          $cond: {
            // Must have effective end date
            if: {
              $and: [
                { $ne: ['$effectiveEndDate', null] },
                { $ne: ['$effectiveEndDate', undefined] }
              ]
            },
            then: {
              $let: {
                vars: {
                  paymentStatus: { $ifNull: ['$paymentResult.status', 'PENDING'] },
                  todayStart: {
                    $dateFromParts: {
                      year: { $year: '$$NOW' },
                      month: { $month: '$$NOW' },
                      day: { $dayOfMonth: '$$NOW' },
                      hour: 0,
                      minute: 0,
                      second: 0
                    }
                  },
                  endDateStart: {
                    $dateFromParts: {
                      year: { $year: '$effectiveEndDate' },
                      month: { $month: '$effectiveEndDate' },
                      day: { $dayOfMonth: '$effectiveEndDate' },
                      hour: 0,
                      minute: 0,
                      second: 0
                    }
                  }
                },
                in: {
                  $let: {
                    vars: {
                      diffDays: {
                        $ceil: {
                          $divide: [
                            { $subtract: ['$$endDateStart', '$$todayStart'] },
                            24 * 60 * 60 * 1000
                          ]
                        }
                      }
                    },
                    in: {
                      $or: [
                        // If payment status is NOT "COMPLETED", always eligible
                        { $ne: ['$$paymentStatus', 'COMPLETED'] },
                        // If payment status IS "COMPLETED", only eligible if diffDays <= 2
                        {
                          $and: [
                            { $eq: ['$$paymentStatus', 'COMPLETED'] },
                            { $lte: ['$$diffDays', 1] }
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            },
            else: false
          }
        }
      }
    });

    // Filter by renewal eligibility BEFORE search
    if (renewalEligible !== undefined && renewalEligible !== null && renewalEligible !== '') {
      const isRenewalEligible = renewalEligible === 'true' || renewalEligible === true || renewalEligible === 'yes';
      pipeline.push({
        $match: {
          renewalEligible: isRenewalEligible
        }
      });
    }

    // Add search functionality AFTER lookups
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { mobile_number: searchRegex },
            { 'userInfo.first_name': searchRegex },
            { 'userInfo.last_name': searchRegex },
            { 'userInfo.phone_data.phone_number': searchRegex },
            { 'planInfo.name': searchRegex },
            { 'batchInfo.name': searchRegex }
          ]
        }
      });
    }
    
    // Add sorting
    pipeline.push({ $sort: { createdAt: -1 } });
    
    // Add facet for pagination and total count
    pipeline.push({
      $facet: {
        bookings: [
          { $skip: skip },
          { $limit: limitNum }
        ],
        totalCount: [
          { $count: 'count' }
        ]
      }
    });

    const result = await MembershipBooking.aggregate(pipeline);
    
    const bookings = result[0].bookings;
    const total = result[0].totalCount[0]?.count || 0;

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          status: status || null,
          planId: planId || null,
          userId: userId || null,
          batchId: batchId || null,
          search: search || null,
          discontinued: discontinued || null,
          renewalEligible: renewalEligible || null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching membership bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership bookings',
      error: error.message
    });
  }
};

exports.getMembershipBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const bookingUserProject = {
      first_name: 1,
      last_name: 1,
      'email_data.temp_email_id': 1,
      'phone_data.phone_number': 1
    };
    if (isAdminRequest(req)) {
      bookingUserProject.admin_remarks = 1;
    }

    // Aggregation pipeline for single booking
    const pipeline = [
      // Match the specific booking
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      
      // Lookup user data
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData',
          pipeline: [
            {
              $project: bookingUserProject
            }
          ]
        }
      },
      
      // Lookup plan data
      {
        $lookup: {
          from: 'membershipplans',
          localField: 'plan',
          foreignField: '_id',
          as: 'planData',
          pipeline: [
            {
              $project: {
                name: 1,
                price: 1,
                billing_interval: 1,
                plan_for: 1
              }
            }
          ]
        }
      },
      
      // Add fields to reshape the data
      {
        $addFields: {
          user: { $arrayElemAt: ['$userData', 0] },
          plan: { $arrayElemAt: ['$planData', 0] }
        }
      },
      
      // Remove the temporary arrays
      {
        $unset: ['userData', 'planData']
      }
    ];

    const result = await MembershipBooking.aggregate(pipeline);
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error('Error fetching membership booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching membership booking',
      error: error.message
    });
  }
};

// Bulk create users for existing bookings without users
// Create membership booking manually by admin
exports.createManualBooking = async (req, res) => {
  try {
    const { 
      planId, 
      userId, 
      batchId, 
      name, 
      age, 
      mobile_number, 
      gender, 
      billing_interval,
      payment_status,
      start_date,
      end_date
    } = req.body;

    // Validate required fields
    if (!planId || !name || !age || !mobile_number || !gender || !billing_interval) {
      return res.status(400).json({ 
        success: false,
        error: 'Plan ID, name, age, mobile number, gender, and billing interval are required' 
      });
    }

    const internalEmail = getInternalEmailFromPhone(mobile_number);

    // Validate IDs
    if (!isValidObjectId(planId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid plan ID' 
      });
    }

    if (userId && !isValidObjectId(userId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid user ID' 
      });
    }

    if (batchId && !isValidObjectId(batchId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid batch ID' 
      });
    }

    // Validate plan exists
    const plan = await MembershipPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ 
        success: false,
        error: 'Membership plan not found' 
      });
    }

    // Validate batch exists in plan (if provided)
    if (batchId) {
      const batch = plan.batches.find(b => b._id.toString() === batchId);
      if (!batch) {
        return res.status(400).json({ 
          success: false,
          error: 'Selected batch not found in the membership plan' 
        });
      }
    }

    // Validate user exists (if provided)
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
    }

    // Resolve or create user: if userId not provided, try to find by phone/email; otherwise create
    let resolvedUserId = userId || null;
    if (!resolvedUserId) {
      const normalizedInputPhone = String(mobile_number || '').replace(/\D/g, '');
      let existingUser = null;
      if (normalizedInputPhone) {
        existingUser = await User.findOne({
          $or: [
            { 'phone_data.phone_number': mobile_number },
            { 'phone_data.phone_number': { $regex: `${normalizedInputPhone}$` } }
          ]
        });
      }
      if (!existingUser && internalEmail) {
        existingUser = await User.findOne({
          $or: [
            { 'email_data.email_id': internalEmail },
            { 'email_data.temp_email_id': internalEmail }
          ]
        });
      }

      if (existingUser) {
        resolvedUserId = existingUser._id;
      } else {
        const [firstName, ...rest] = (name || 'User').trim().split(/\s+/);
        const lastName = rest.join(' ') || 'User';
        const password = `${firstName || 'User'}@123`;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
          first_name: firstName || 'User',
          last_name: lastName,
          media: [],
          email_data: { temp_email_id: internalEmail, is_validated: true },
          phone_data: { phone_number: mobile_number, is_validated: true },
          role: 'USER',
          password: hashedPassword,
          is_active: true,
          is_archived: false
        });
        resolvedUserId = newUser._id;
      }
    }

    // Validate payment status
    const validPaymentStatuses = ['initiated', 'COMPLETED', 'FAILED', 'PENDING'];
    if (payment_status && !validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid payment status. Must be one of: initiated, COMPLETED, FAILED, PENDING' 
      });
    }

    // Validate dates
    let startDate, endDate;
    if (start_date) {
      startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid start date format' 
        });
      }
    } else {
      startDate = new Date(); // Default to current date
    }

    if (end_date) {
      endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid end date format' 
        });
      }
    } else {
      // Calculate end date based on billing interval
      const normInterval = normalizeBillingInterval(billing_interval);
      const monthsToAdd = INTERVAL_TO_MONTHS[normInterval] || INTERVAL_TO_MONTHS[billing_interval] || 1;
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + monthsToAdd);
    }

    // Create the booking (use canonical lowercase billing_interval)
    const normalizedInterval = normalizeBillingInterval(billing_interval);
    const bookingData = {
      plan: planId,
      batchId: batchId || null,
      user: resolvedUserId,
      name,
      age,
      email: internalEmail,
      mobile_number,
      gender,
      billing_interval: normalizedInterval,
      start_date: startDate,
      end_date: endDate,
      renewal_date: startDate,
      paymentResult: {
        status: payment_status || 'initiated'
      }
    };

    const newBooking = await MembershipBooking.create(bookingData);

    // Populate the response
    const populatedBooking = await MembershipBooking.findById(newBooking._id)
      .populate('plan', 'name price billing_interval plan_for')
      .populate('user', 'first_name last_name email_data phone_data')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Membership booking created successfully',
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

// Update membership booking manually by admin
exports.updateManualBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid booking ID' 
      });
    }

    // Validate payment status if provided
    if (updateData.payment_status) {
      const validPaymentStatuses = ['initiated', 'COMPLETED', 'FAILED', 'PENDING'];
      if (!validPaymentStatuses.includes(updateData.payment_status)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid payment status. Must be one of: initiated, COMPLETED, FAILED, PENDING' 
        });
      }
    }

    // Validate dates if provided
    if (updateData.start_date) {
      const startDate = new Date(updateData.start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid start date format' 
        });
      }
    }

    if (updateData.end_date) {
      const endDate = new Date(updateData.end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid end date format' 
        });
      }
    }

    if (updateData.renewal_date) {
      const renewalDate = new Date(updateData.renewal_date);
      if (isNaN(renewalDate.getTime())) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid renewal date format' 
        });
      }
    }

    // Prepare update data
    const updateFields = {};
    if (updateData.planId) updateFields.plan = updateData.planId;
    if (updateData.userId) updateFields.user = updateData.userId;
    if (updateData.batchId) updateFields.batchId = updateData.batchId;
    if (updateData.name) updateFields.name = updateData.name;
    if (updateData.age) updateFields.age = updateData.age;
    if (updateData.email) updateFields.email = updateData.email;
    if (updateData.mobile_number) updateFields.mobile_number = updateData.mobile_number;
    if (updateData.gender) updateFields.gender = updateData.gender;
    if (updateData.billing_interval) updateFields.billing_interval = normalizeBillingInterval(updateData.billing_interval);
    if (updateData.start_date) updateFields.start_date = new Date(updateData.start_date);
    if (updateData.end_date) updateFields.end_date = new Date(updateData.end_date);
    if (updateData.renewal_date) updateFields.renewal_date = new Date(updateData.renewal_date);
    if (updateData.payment_status) {
      updateFields['paymentResult.status'] = updateData.payment_status;
    }

    const updatedBooking = await MembershipBooking.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    ).populate('plan', 'name price billing_interval plan_for')
     .populate('user', 'first_name last_name email_data phone_data')
     .lean();

    if (!updatedBooking) {
      return res.status(404).json({ 
        success: false,
        error: 'Membership booking not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Membership booking updated successfully',
      data: updatedBooking
    });

  } catch (error) {
    console.error('Error updating manual booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating manual booking',
      error: error.message
    });
  }
};

exports.createUsersForExistingBookings = async (req, res) => {
  try {
    console.log('Starting bulk user creation for existing bookings...');

    // Find all bookings without user field
    const bookingsWithoutUser = await MembershipBooking.find({
      user: { $exists: false }
    }).lean();

    console.log(`Found ${bookingsWithoutUser.length} bookings without users`);

    let createdUsers = 0;
    let existingUsers = 0;
    let errors = 0;
    const errorDetails = [];

    for (const booking of bookingsWithoutUser) {
      try {
        console.log(`Processing booking: ${booking._id} for ${booking.email}`);

        // Create new user for each booking based on name only
        const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
        const lastName = rest.join(' ') || 'User';
        
        // Create unique email based on name and booking ID
        const uniqueEmail = `${firstName.toLowerCase()}_${booking._id}@temp.com`;
        
        // Create password based on name
        const password = `${firstName || 'User'}@123`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
          first_name: firstName || 'User',
          last_name: lastName,
          media: [],
          email_data: { temp_email_id: uniqueEmail, is_validated: true },
          phone_data: { phone_number: booking.mobile_number, is_validated: true },
          role: 'USER',
          password: hashedPassword,
          is_active: true,
          is_archived: false
        });

        console.log(`  ✓ Created new user: ${user._id} (${firstName} ${lastName})`);
        createdUsers++;

        // Update booking with user reference
        await MembershipBooking.findByIdAndUpdate(booking._id, {
          user: user._id
        });

        console.log(`  ✓ Updated booking ${booking._id} with user ${user._id}`);

      } catch (error) {
        console.error(`  ✗ Error processing booking ${booking._id}:`, error.message);
        errors++;
        errorDetails.push({
          bookingId: booking._id,
          email: booking.email,
          error: error.message
        });
      }
    }

    // Verify results
    const remainingBookingsWithoutUser = await MembershipBooking.countDocuments({
      user: { $exists: false }
    });

    const summary = {
      totalBookingsProcessed: bookingsWithoutUser.length,
      newUsersCreated: createdUsers,
      existingUsersFound: existingUsers,
      errors: errors,
      remainingBookingsWithoutUser: remainingBookingsWithoutUser,
      errorDetails: errorDetails
    };

    console.log('\n=== SUMMARY ===');
    console.log(`Total bookings processed: ${summary.totalBookingsProcessed}`);
    console.log(`New users created: ${summary.newUsersCreated}`);
    console.log(`Existing users found: ${summary.existingUsersFound}`);
    console.log(`Errors: ${summary.errors}`);
    console.log(`Remaining bookings without users: ${summary.remainingBookingsWithoutUser}`);

    res.status(200).json({
      success: true,
      message: 'Bulk user creation completed',
      data: summary
    });

  } catch (error) {
    console.error('Bulk user creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in bulk user creation',
      error: error.message
    });
  }
};

exports.manualRenewMembership = async (req, res) => {
  try {
    const { membershipBookingId } = req.params;
    const {
      planId,
      batchId,
      billing_interval,
      renewal_date, // optional: admin-specified renewal date
      end_date    // optional: allow admin to specify new end date if needed
    } = req.body;

    if (!isValidObjectId(membershipBookingId)) {
      return res.status(400).json({ error: 'Invalid membership booking ID' });
    }

    const existingBooking = await MembershipBooking.findById(membershipBookingId);
    if (!existingBooking) {
      return res.status(404).json({ error: 'Membership booking not found' });
    }

    if (!isValidObjectId(planId)) {
      return res.status(400).json({ error: 'Invalid planId' });
    }
    const newPlan = await MembershipPlan.findById(planId);
    if (!newPlan || !newPlan.is_active) {
      return res.status(404).json({ error: 'Membership plan not found or inactive' });
    }

    const batch = newPlan.batches.find(b => b._id.toString() === batchId);
    if (!batch) {
      return res.status(400).json({ error: 'Selected batch not found in the plan' });
    }

    // Normalize billing_interval to canonical form
    const normalizedBillingInterval = normalizeBillingInterval(billing_interval);

    // Calculate new dates
    const monthsToAdd = INTERVAL_TO_MONTHS[normalizedBillingInterval] || 1;

    // Determine renewal date (defaults to now if not provided)
    const newRenewalDate = renewal_date ? new Date(renewal_date) : new Date();
    if (isNaN(newRenewalDate.getTime())) {
      return res.status(400).json({ error: 'Invalid renewal_date format' });
    }

    let newEndDate;
    if (end_date) {
      newEndDate = new Date(end_date);
      if (isNaN(newEndDate.getTime())) {
        return res.status(400).json({ error: 'Invalid end_date format' });
      }
    } else {
      newEndDate = new Date(newRenewalDate);
      newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd);
    }

    // Update existing booking with new plan, batch and extended dates
    existingBooking.plan = planId;
    existingBooking.batchId = batch._id;
    existingBooking.billing_interval = normalizedBillingInterval;
    // Do not change start_date on manual renewal
    existingBooking.end_date = newEndDate;
    // For renewals, set the renewal date (provided or now)
    existingBooking.renewal_date = newRenewalDate;

    // Mark payment as completed since admin is doing manual renewal
    existingBooking.paymentResult = { status: 'COMPLETED' };
    // Any customer renewal still awaiting payment is superseded
    existingBooking.pending_renewal = undefined;

    await existingBooking.save();

    // Populate for response
    const populatedBooking = await MembershipBooking.findById(existingBooking._id)
      .populate('plan', 'name price billing_interval plan_for')
      .populate('user', 'first_name last_name email_data phone_data')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Membership successfully renewed by updating existing booking.',
      data: populatedBooking
    });

  } catch (err) {
    console.error('Admin manual renewal update error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};


exports.toggleDiscontinued = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await mongoose.model('membershipbooking').findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Membership booking not found' });
    }

    // Toggle the discontinued status
    booking.discontinued = !booking.discontinued;
    await booking.save();

    res.json({ 
      message: `Booking has been ${booking.discontinued ? 'discontinued' : 'reactivated'}.`,
      booking
    });
  } catch (err) {
    console.error('Error toggling discontinued status:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Explicitly set discontinued to false (reactivate)
exports.setDiscontinuedFalse = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!isValidObjectId(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await MembershipBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Membership booking not found' });
    }

    if (booking.discontinued === false) {
      return res.json({ message: 'Booking already active.', booking });
    }

    booking.discontinued = false;
    await booking.save();

    res.json({ message: 'Booking reactivated.', booking });
  } catch (err) {
    console.error('Error reactivating booking:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateUserAndBooking = async (req, res) => {
  try {
    const { userId, bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const updateUserData = req.body.user || {};
    const updateBookingData = req.body.booking || {};

    console.log("Received user update data:", updateUserData);
    console.log("Received booking update data:", updateBookingData);

    // Update user document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateUserData },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    console.log("Updated user:", updatedUser);

    // Update booking document ownership check
    const booking = await MembershipBooking.findOne({ _id: bookingId, user: userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found for this user' });
    }

    const allowedBookingFields = ['name', 'age', 'mobile_number', 'gender', 'discontinued', 'renewal_date', 'start_date', 'end_date'];
    const bookingFieldsToUpdate = {};
    allowedBookingFields.forEach(field => {
      if (field in updateBookingData) {
        if (field === 'renewal_date' || field === 'start_date' || field === 'end_date') {
          const rd = new Date(updateBookingData[field]);
          if (!isNaN(rd.getTime())) {
            bookingFieldsToUpdate[field] = rd;
          }
        } else {
          bookingFieldsToUpdate[field] = updateBookingData[field];
        }
      }
    });

    console.log('Booking fields to update:', bookingFieldsToUpdate);
    if (Object.keys(bookingFieldsToUpdate).length > 0) {
      Object.assign(booking, bookingFieldsToUpdate);
      const updatedBooking = await booking.save();
      console.log('Updated booking:', updatedBooking);
      return res.json({ user: updatedUser, booking: updatedBooking });
    } else {
      console.log('No booking fields provided to update');
      return res.json({ user: updatedUser, booking: booking });
    }

  } catch (error) {
    console.error('Error updating user and booking:', error);
    res.status(500).json({ message: 'Error updating user and booking', error: error.message });
  }
};

exports.deleteUserAndMemberships = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if id is a valid ObjectId
    const isValidId = isValidObjectId(id);
    
    let user = null;
    let deleteBookingsResult = null;
    let deletedUser = false;

    // If id is a valid ObjectId, try to find the user
    if (isValidId) {
      user = await User.findById(id);
    }

    if (user) {
      // User exists: delete all membership bookings for this user
      deleteBookingsResult = await MembershipBooking.deleteMany({ user: id });
      
      // Delete the user
      await User.findByIdAndDelete(id);
      deletedUser = true;

      res.status(200).json({
        success: true,
        message: 'User and all associated membership bookings deleted successfully',
        data: {
          deletedUserId: id,
          deletedMembershipBookings: deleteBookingsResult.deletedCount,
          userDeleted: true
        }
      });
    } else {
      // User doesn't exist: delete only membership bookings
      // If id is valid, delete bookings with that user ID
      // If id is invalid/null, delete bookings without users
      if (isValidId) {
        deleteBookingsResult = await MembershipBooking.deleteMany({ user: id });
      } else {
        // Delete bookings where user is null or doesn't exist
        deleteBookingsResult = await MembershipBooking.deleteMany({ 
          $or: [
            { user: null },
            { user: { $exists: false } }
          ]
        });
      }

      res.status(200).json({
        success: true,
        message: 'Membership bookings deleted successfully (user did not exist)',
        data: {
          deletedUserId: isValidId ? id : null,
          deletedMembershipBookings: deleteBookingsResult.deletedCount,
          userDeleted: false
        }
      });
    }

  } catch (error) {
    console.error('Error deleting user and memberships:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user and memberships',
      error: error.message
    });
  }
};
