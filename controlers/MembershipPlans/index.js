const mongoose = require('mongoose');
const MembershipPlan = require('../../modals/MembershipPlans');
const MembershipBooking = require('../../modals/MembershipBooking');
const User = require('../../modals/Users');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const env = Env.SANDBOX

const client = new StandardCheckoutClient(clientId, clientSecret, env)

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
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

exports.createPlan = async (req, res) => {
    try {
        const { name, description, price, billing_interval, benefits, is_active, plan_for } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Valid name is required' });
        }
        if (price === undefined || typeof price !== 'number' || price < 0) {
            return res.status(400).json({ error: 'Valid price is required' });
        }
        const intervals = ['MONTHLY', '3_MONTHS', '6_MONTHS', 'YEARLY'];
        if (billing_interval && !intervals.includes(billing_interval)) {
            return res.status(400).json({ error: 'Invalid billing_interval' });
        }
        if (benefits && !Array.isArray(benefits)) {
            return res.status(400).json({ error: 'benefits must be an array of strings' });
        }
        if (plan_for !== undefined) {
            const allowedAudiences = ['KIDS', 'ADULTS'];
            if (!allowedAudiences.includes(plan_for)) {
                return res.status(400).json({ error: 'Invalid plan_for' });
            }
        }

        const plan = await MembershipPlan.create({
            name,
            description,
            price,
            billing_interval: billing_interval || 'MONTHLY',
            benefits: benefits || [],
            plan_for: plan_for || 'ADULTS',
            is_active: is_active !== undefined ? !!is_active : true
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
            plan_for
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
            const allowedAudiences = ['KIDS', 'ADULTS'];
            if (allowedAudiences.includes(plan_for)) filter.plan_for = plan_for;
        }
        if (q && typeof q === 'string' && q.trim()) {
            const pattern = new RegExp(q.trim(), 'i');
            filter.$or = [{ name: pattern }, { description: pattern }];
        }

        const [items, total] = await Promise.all([
            MembershipPlan.find(filter)
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
        const plan = await MembershipPlan.findById(id).lean();
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

        const allowed = ['name', 'description', 'price', 'billing_interval', 'benefits', 'is_active', 'plan_for'];
        const updateData = pick(req.body, allowed);

        if (updateData.price !== undefined) {
            if (typeof updateData.price !== 'number' || updateData.price < 0) {
                return res.status(400).json({ error: 'Invalid price' });
            }
        }
        if (updateData.billing_interval !== undefined) {
            const intervals = ['MONTHLY', '3_MONTHS', '6_MONTHS', 'YEARLY'];
            if (!intervals.includes(updateData.billing_interval)) {
                return res.status(400).json({ error: 'Invalid billing_interval' });
            }
        }
        if (updateData.benefits !== undefined && !Array.isArray(updateData.benefits)) {
            return res.status(400).json({ error: 'benefits must be an array' });
        }
        if (updateData.plan_for !== undefined) {
            const allowedAudiences = ['KIDS', 'ADULTS'];
            if (!allowedAudiences.includes(updateData.plan_for)) {
                return res.status(400).json({ error: 'Invalid plan_for' });
            }
        }

        const updated = await MembershipPlan.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );
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



exports.createBooking = async (req, res) => {
    try {
        const { planId, name, age, email, mobile_number, gender, paymentResult } = req.body;

        if (!isValidObjectId(planId)) {
            return res.status(400).json({ error: 'Invalid planId' });
        }
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Valid name is required' });
        }
        if (age === undefined || typeof age !== 'number' || age < 0) {
            return res.status(400).json({ error: 'Valid age is required' });
        }
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        if (!mobile_number || typeof mobile_number !== 'string') {
            return res.status(400).json({ error: 'Valid mobile_number is required' });
        }
        const allowedGenders = ['Male', 'Female', 'Other'];
        if (!gender || !allowedGenders.includes(gender)) {
            return res.status(400).json({ error: 'Valid gender is required' });
        }

        const plan = await MembershipPlan.findById(planId).lean();
        if (!plan || plan.is_active === false) {
            return res.status(404).json({ error: 'Membership plan not found or inactive' });
        }

        // Create booking before payment (no user yet)
        const booking = await MembershipBooking.create({
            plan: plan._id,
            name,
            age,
            email,
            mobile_number,
            gender,
            paymentResult: paymentResult || { status: 'initiated' }
        });

        const merchantOrderId = booking._id.toString();
        const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
        const priceInPaise = Math.round((plan.price || 0) * 100);

        const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
            .merchantOrderId(merchantOrderId)
            .amount(priceInPaise)
            .redirectUrl(redirectUrl)
            .build();

        const paymentResponse = await client.pay(paymentRequest);

        return res.status(201).json({
            message: 'Membership booking initiated. Please complete payment.',
            booking,
            checkoutPageUrl: paymentResponse.redirectUrl
        });
    } catch (err) {
        console.error('Create membership booking error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.checkMembershipStatus = async (req, res) => {
    console.log('checkMembershipStatus invoked with query:', req.query);
    try {
        const { merchantOrderId } = req.query;
        if (!merchantOrderId) {
            return res.status(400).send('merchantOrderId is required');
        }

        const response = await client.getOrderStatus(merchantOrderId);
        const status = response.state;

        const booking = await MembershipBooking.findById(merchantOrderId);
        if (!booking) {
            return res.status(404).send('Booking not found');
        }

        if (status === 'COMPLETED') {
            // Create user only now (post-payment) if not exists, then attach to booking
            let user = await User.findOne({ 'email_data.email_id': booking.email });
            if (!user) {
                const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
                const lastName = rest.join(' ');
                const password = `${firstName || 'User'}@123`;

                user = await User.create({
                    first_name: firstName || booking.name || 'User',
                    last_name: lastName || '',
                    media: [],
                    email_data: { temp_email_id: booking.email, is_validated: true },
                    phone_data: { phone_number: booking.mobile_number, is_validated: true },
                    role: 'USER',
                    password,
                    is_active: true,
                    is_archived: false
                });
            }

            await MembershipBooking.findByIdAndUpdate(
                merchantOrderId,
                {
                    user: user._id,
                    'paymentResult.status': 'COMPLETED',
                    'paymentResult.paymentDate': new Date(),
                    'paymentResult.phonepeResponse': response
                }
            );
            return res.redirect(`http://localhost:5173/payment-success`);
        } else {
            await MembershipBooking.findByIdAndUpdate(
                merchantOrderId,
                {
                    'paymentResult.status': 'FAILED',
                    'paymentResult.phonepeResponse': response
                }
            );
            return res.redirect(`http://localhost:5173/payment-failure`);
        }
    } catch (err) {
        console.error('Check membership status error:', err);
        return res.status(500).send('Internal server error during payment status check');
    }
};
