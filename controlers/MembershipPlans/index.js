const mongoose = require('mongoose');
const MembershipPlan = require('../../modals/MembershipPlans');
const MembershipBooking = require('../../modals/MembershipBooking');
const ClassType = require('../../modals/ClassTypes');
const User = require('../../modals/Users');
const bcrypt = require('bcryptjs');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const jwt = require('jsonwebtoken');
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
        const { name, description, price, billing_interval, benefits, is_active, plan_for, classTypeId } = req.body;
        if (!classTypeId || !isValidObjectId(classTypeId)) {
            return res.status(400).json({ error: 'Valid classTypeId is required' });
        }
        const classType = await ClassType.findById(classTypeId).lean();
        if (!classType) {
            return res.status(404).json({ error: 'Class type not found' });
        }

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
            is_active: is_active !== undefined ? !!is_active : true,
            class_type: classType._id
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
            const allowedAudiences = ['KIDS', 'ADULTS'];
            if (allowedAudiences.includes(plan_for)) filter.plan_for = plan_for;
        }
        if (q && typeof q === 'string' && q.trim()) {
            const pattern = new RegExp(q.trim(), 'i');
            filter.$or = [{ name: pattern }, { description: pattern }];
        }
        if (classTypeId && isValidObjectId(classTypeId)) {
            filter.class_type = classTypeId;
        }

        const [items, total] = await Promise.all([
            MembershipPlan.find(filter)
                .populate('class_type')
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
        const plan = await MembershipPlan.findById(id).populate('class_type').lean();
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

        const allowed = ['name', 'description', 'price', 'billing_interval', 'benefits', 'is_active', 'plan_for', 'classTypeId'];
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

        const updateDoc = { ...updateData };
        if (updateData.classTypeId !== undefined) {
            if (!isValidObjectId(updateData.classTypeId)) {
                return res.status(400).json({ error: 'Invalid classTypeId' });
            }
            const classType = await ClassType.findById(updateData.classTypeId).lean();
            if (!classType) {
                return res.status(404).json({ error: 'Class type not found' });
            }
            updateDoc.class_type = classType._id;
            delete updateDoc.classTypeId;
        }

        const updated = await MembershipPlan.findByIdAndUpdate(
            id,
            updateDoc,
            { new: true, runValidators: true }
        ).populate('class_type');
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
                const hashedPassword = await bcrypt.hash(password, 10);

                user = await User.create({
                    first_name: firstName || booking.name || 'User',
                    last_name: lastName || '',
                    media: [],
                    email_data: { temp_email_id: booking.email, is_validated: true },
                    phone_data: { phone_number: booking.mobile_number, is_validated: true },
                    role: 'USER',
                    password: hashedPassword,
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

// Get membership plan details for a specific user
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

// User: renew expired membership
exports.renewMembership = async (req, res) => {
    try {
        const { membershipBookingId } = req.params;
        const { planId } = req.body;

        if (!isValidObjectId(membershipBookingId)) {
            return res.status(400).json({ error: 'Invalid membership booking ID' });
        }

        if (!planId || !isValidObjectId(planId)) {
            return res.status(400).json({ error: 'Valid planId is required' });
        }

        // Find the existing membership booking
        const existingBooking = await MembershipBooking.findById(membershipBookingId)
            .populate('plan')
            .lean();

        if (!existingBooking) {
            return res.status(404).json({ error: 'Membership booking not found' });
        }

        // Check if membership is expired
        const now = new Date();
        if (existingBooking.end_date && existingBooking.end_date > now) {
            return res.status(400).json({ error: 'Membership is not expired yet' });
        }

        // Get the new plan
        const newPlan = await MembershipPlan.findById(planId).lean();
        if (!newPlan || !newPlan.is_active) {
            return res.status(404).json({ error: 'Membership plan not found or inactive' });
        }

        // Calculate new end date based on new plan's billing interval
        const INTERVAL_TO_MONTHS = {
            MONTHLY: 1,
            '3_MONTHS': 3,
            '6_MONTHS': 6,
            YEARLY: 12
        };

        const startDate = existingBooking.end_date || new Date();
        const monthsToAdd = INTERVAL_TO_MONTHS[newPlan.billing_interval] || 1;
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + monthsToAdd);

        // Create new membership booking for renewal
        const renewalBooking = await MembershipBooking.create({
            user: existingBooking.user,
            plan: newPlan._id,
            name: existingBooking.name,
            age: existingBooking.age,
            email: existingBooking.email,
            mobile_number: existingBooking.mobile_number,
            gender: existingBooking.gender,
            start_date: startDate,
            end_date: endDate,
            paymentResult: { status: 'initiated' }
        });

        // Generate payment request
        const merchantOrderId = renewalBooking._id.toString();
        const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
        const priceInPaise = Math.round((newPlan.price || 0) * 100);

        const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
            .merchantOrderId(merchantOrderId)
            .amount(priceInPaise)
            .redirectUrl(redirectUrl)
            .build();

        const paymentResponse = await client.pay(paymentRequest);

        return res.status(201).json({
            message: 'Membership renewal initiated. Please complete payment.',
            renewalBooking,
            checkoutPageUrl: paymentResponse.redirectUrl
        });
    } catch (err) {
        console.error('Renew membership error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
