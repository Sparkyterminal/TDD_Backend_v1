const mongoose = require('mongoose');
const axios = require('axios');

require('dotenv').config();
const MembershipPlan = require('../../modals/MembershipPlans');
const MembershipBooking = require('../../modals/MembershipBooking');
const ClassType = require('../../modals/ClassTypes');
const User = require('../../modals/Users');
const bcrypt = require('bcryptjs');
const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')

// const {StandardCheckoutClient, Env, StandardCheckoutPayRequest} = require('pg-sdk-node')
const jwt = require('jsonwebtoken');
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET
const clientVersion = 1
const env = Env.PRODUCTION
const client = StandardCheckoutClient.getInstance(clientId,clientSecret,clientVersion,env)

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

// exports.createPlan = async (req, res) => {
//     try {
//         const { name, description, dance_type, prices, benefits, is_active, plan_for, kids_category, image, batches } = req.body;
//         if (!dance_type || !isValidObjectId(dance_type)) {
//             return res.status(400).json({ error: 'Valid dance_type is required' });
//         }
//         const classType = await ClassType.findById(dance_type).lean();
//         if (!classType) {
//             return res.status(404).json({ error: 'Dance type not found' });
//         }

//         if (!name || typeof name !== 'string') {
//             return res.status(400).json({ error: 'Valid name is required' });
//         }
//         if (!prices || typeof prices !== 'object') {
//             return res.status(400).json({ error: 'Valid prices object is required' });
//         }
//         if (prices.monthly === undefined || typeof prices.monthly !== 'number' || prices.monthly < 0) {
//             return res.status(400).json({ error: 'Valid monthly price is required' });
//         }
//         // Validate other prices if provided
//         const optionalPrices = ['quarterly', 'half_yearly', 'yearly'];
//         for (const priceType of optionalPrices) {
//             if (prices[priceType] !== undefined && (typeof prices[priceType] !== 'number' || prices[priceType] < 0)) {
//                 return res.status(400).json({ error: `Valid ${priceType} price is required` });
//             }
//         }
//         if (benefits && !Array.isArray(benefits)) {
//             return res.status(400).json({ error: 'benefits must be an array of strings' });
//         }
//         if (image && !isValidObjectId(image)) {
//             return res.status(400).json({ error: 'Invalid image ID' });
//         }
//         if (batches && !Array.isArray(batches)) {
//             return res.status(400).json({ error: 'batches must be an array' });
//         }
//         if (batches && batches.length > 0) {
//             for (const batch of batches) {
//                 if (!batch.days || !Array.isArray(batch.days) || batch.days.length === 0) {
//                     return res.status(400).json({ error: 'Each batch must have days array with at least one day' });
//                 }
//                 const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
//                 for (const day of batch.days) {
//                     if (!validDays.includes(day)) {
//                         return res.status(400).json({ error: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}` });
//                     }
//                 }
//                 if (!batch.start_time || !batch.end_time) {
//                     return res.status(400).json({ error: 'Each batch must have start_time and end_time' });
//                 }
//                 // Validate time format (HH:MM)
//                 const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
//                 if (!timeRegex.test(batch.start_time) || !timeRegex.test(batch.end_time)) {
//                     return res.status(400).json({ error: 'Time must be in HH:MM format' });
//                 }
//                 if (batch.start_time >= batch.end_time) {
//                     return res.status(400).json({ error: 'Batch start_time must be before end_time' });
//                 }
//                 if (batch.capacity !== undefined && (typeof batch.capacity !== 'number' || batch.capacity < 0)) {
//                     return res.status(400).json({ error: 'Batch capacity must be a non-negative number' });
//                 }
//             }
//         }
//         if (plan_for !== undefined) {
//             const allowedAudiences = ['KID', 'KIDS', 'ADULT'];
//             if (!allowedAudiences.includes(plan_for)) {
//                 return res.status(400).json({ error: 'Invalid plan_for' });
//             }
//         }
//         if ((plan_for === 'KID' || plan_for === 'KIDS') && (!kids_category || !['JUNIOR', 'ADVANCED'].includes(kids_category))) {
//             return res.status(400).json({ error: 'Kids category is required for KID/KIDS plans and must be JUNIOR or ADVANCED' });
//         }
//         if (plan_for === 'ADULT' && kids_category) {
//             return res.status(400).json({ error: 'Kids category should not be provided for ADULT plans' });
//         }

//         const plan = await MembershipPlan.create({
//             name,
//             description,
//             dance_type: classType._id,
//             prices,
//             benefits: benefits || [],
//             plan_for: plan_for || 'ADULT',
//             kids_category: (plan_for === 'KID' || plan_for === 'KIDS') ? kids_category : undefined,
//             is_active: is_active !== undefined ? !!is_active : true,
//             image: image || undefined,
//             batches: batches || []
//         });

//         return res.status(201).json(plan);
//     } catch (err) {
//         console.error('Create membership plan error:', err);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };


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

// exports.updatePlan = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!isValidObjectId(id)) {
//             return res.status(400).json({ error: 'Invalid plan ID' });
//         }

//         const allowed = ['name', 'description', 'prices', 'benefits', 'is_active', 'plan_for', 'kids_category', 'dance_type', 'image', 'batches'];
//         const updateData = pick(req.body, allowed);

//         if (updateData.prices !== undefined) {
//             if (typeof updateData.prices !== 'object') {
//                 return res.status(400).json({ error: 'Invalid prices object' });
//             }
//             if (updateData.prices.monthly !== undefined && (typeof updateData.prices.monthly !== 'number' || updateData.prices.monthly < 0)) {
//                 return res.status(400).json({ error: 'Valid monthly price is required' });
//             }
//             const optionalPrices = ['quarterly', 'half_yearly', 'yearly'];
//             for (const priceType of optionalPrices) {
//                 if (updateData.prices[priceType] !== undefined && (typeof updateData.prices[priceType] !== 'number' || updateData.prices[priceType] < 0)) {
//                     return res.status(400).json({ error: `Valid ${priceType} price is required` });
//                 }
//             }
//         }
//         if (updateData.benefits !== undefined && !Array.isArray(updateData.benefits)) {
//             return res.status(400).json({ error: 'benefits must be an array' });
//         }
//         if (updateData.plan_for !== undefined) {
//             const allowedAudiences = ['KID', 'KIDS', 'ADULT'];
//             if (!allowedAudiences.includes(updateData.plan_for)) {
//                 return res.status(400).json({ error: 'Invalid plan_for' });
//             }
//         }
//         if ((updateData.plan_for === 'KID' || updateData.plan_for === 'KIDS') && (!updateData.kids_category || !['JUNIOR', 'ADVANCED'].includes(updateData.kids_category))) {
//             return res.status(400).json({ error: 'Kids category is required for KID/KIDS plans and must be JUNIOR or ADVANCED' });
//         }
//         if (updateData.plan_for === 'ADULT' && updateData.kids_category) {
//             return res.status(400).json({ error: 'Kids category should not be provided for ADULT plans' });
//         }
//         if (updateData.dance_type !== undefined) {
//             if (!isValidObjectId(updateData.dance_type)) {
//                 return res.status(400).json({ error: 'Invalid dance_type ID' });
//             }
//         }
//         if (updateData.image !== undefined) {
//             if (updateData.image && !isValidObjectId(updateData.image)) {
//                 return res.status(400).json({ error: 'Invalid image ID' });
//             }
//         }
//         if (updateData.batches !== undefined) {
//             if (!Array.isArray(updateData.batches)) {
//                 return res.status(400).json({ error: 'batches must be an array' });
//             }
//             for (const batch of updateData.batches) {
//                 if (!batch.days || !Array.isArray(batch.days) || batch.days.length === 0) {
//                     return res.status(400).json({ error: 'Each batch must have days array with at least one day' });
//                 }
//                 const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
//                 for (const day of batch.days) {
//                     if (!validDays.includes(day)) {
//                         return res.status(400).json({ error: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}` });
//                     }
//                 }
//                 if (!batch.start_time || !batch.end_time) {
//                     return res.status(400).json({ error: 'Each batch must have start_time and end_time' });
//                 }
//                 // Validate time format (HH:MM)
//                 const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
//                 if (!timeRegex.test(batch.start_time) || !timeRegex.test(batch.end_time)) {
//                     return res.status(400).json({ error: 'Time must be in HH:MM format' });
//                 }
//                 if (batch.start_time >= batch.end_time) {
//                     return res.status(400).json({ error: 'Batch start_time must be before end_time' });
//                 }
//                 if (batch.capacity !== undefined && (typeof batch.capacity !== 'number' || batch.capacity < 0)) {
//                     return res.status(400).json({ error: 'Batch capacity must be a non-negative number' });
//                 }
//             }
//         }

//         const updateDoc = { ...updateData };
//         if (updateData.dance_type !== undefined) {
//             const classType = await ClassType.findById(updateData.dance_type).lean();
//             if (!classType) {
//                 return res.status(404).json({ error: 'Dance type not found' });
//             }
//         }

//         const updated = await MembershipPlan.findByIdAndUpdate(
//             id,
//             updateDoc,
//             { new: true, runValidators: true }
//         ).populate('dance_type').populate('image');
//         if (!updated) {
//             return res.status(404).json({ error: 'Membership plan not found' });
//         }
//         return res.json(updated);
//     } catch (err) {
//         console.error('Update membership plan error:', err);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };


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

// exports.createBooking = async (req, res) => {
//     try {
//         const { planId, name, age, email, mobile_number, gender, paymentResult } = req.body;

//         // Validate planId
//         if (!isValidObjectId(planId)) {
//             return res.status(400).json({ error: 'Invalid planId' });
//         }

//         // Validate personal details
//         if (!name || typeof name !== 'string') {
//             return res.status(400).json({ error: 'Valid name is required' });
//         }
//         if (age === undefined || typeof age !== 'number' || age < 0) {
//             return res.status(400).json({ error: 'Valid age is required' });
//         }
//         if (!email || typeof email !== 'string') {
//             return res.status(400).json({ error: 'Valid email is required' });
//         }
//         if (!mobile_number || typeof mobile_number !== 'string') {
//             return res.status(400).json({ error: 'Valid mobile_number is required' });
//         }
//         const allowedGenders = ['Male', 'Female', 'Other'];
//         if (!gender || !allowedGenders.includes(gender)) {
//             return res.status(400).json({ error: 'Valid gender is required' });
//         }

//         // Fetch the plan and check if active
//         const plan = await MembershipPlan.findById(planId).lean();
//         if (!plan || plan.is_active === false) {
//             return res.status(404).json({ error: 'Membership plan not found or inactive' });
//         }

//         // Determine price - you may want to specify which price plan to choose (e.g., monthly)
//         // Here, defaulting to monthly price
//         const price = plan.prices?.monthly;
//         if (price === undefined || price < 0) {
//             return res.status(400).json({ error: 'Invalid price on membership plan' });
//         }

//         // Create booking before payment is completed
//         const booking = await MembershipBooking.create({
//             plan: plan._id,
//             name,
//             age,
//             email,
//             mobile_number,
//             gender,
//             paymentResult: paymentResult || { status: 'initiated' }
//         });

//         const merchantOrderId = booking._id.toString();

//         // Update your redirect URL to your deployment or frontend endpoint as needed
//         const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;

//         // Convert price to smallest currency unit (e.g., paise)
//         const priceInPaise = Math.round(price * 100);

//         // Build payment request
//         const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
//             .merchantOrderId(merchantOrderId)
//             .amount(priceInPaise)
//             .redirectUrl(redirectUrl)
//             .build();

//         // Trigger payment SDK request
//         const paymentResponse = await client.pay(paymentRequest);

//         return res.status(201).json({
//             message: 'Membership booking initiated. Please complete payment.',
//             booking,
//             checkoutPageUrl: paymentResponse.redirectUrl
//         });
//     } catch (err) {
//         console.error('Create membership booking error:', err);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };

// exports.createBooking = async (req, res) => {
//     try {
//         const { planId, name, age, email, mobile_number, gender, paymentResult } = req.body;

//         if (!isValidObjectId(planId)) {
//             return res.status(400).json({ error: 'Invalid planId' });
//         }
//         if (!name || typeof name !== 'string') {
//             return res.status(400).json({ error: 'Valid name is required' });
//         }
//         if (age === undefined || typeof age !== 'number' || age < 0) {
//             return res.status(400).json({ error: 'Valid age is required' });
//         }
//         if (!email || typeof email !== 'string') {
//             return res.status(400).json({ error: 'Valid email is required' });
//         }
//         if (!mobile_number || typeof mobile_number !== 'string') {
//             return res.status(400).json({ error: 'Valid mobile_number is required' });
//         }
//         const allowedGenders = ['Male', 'Female', 'Other'];
//         if (!gender || !allowedGenders.includes(gender)) {
//             return res.status(400).json({ error: 'Valid gender is required' });
//         }

//         const plan = await MembershipPlan.findById(planId).lean();
//         if (!plan || plan.is_active === false) {
//             return res.status(404).json({ error: 'Membership plan not found or inactive' });
//         }

//         // Create booking before payment (no user yet)
//         const booking = await MembershipBooking.create({
//             plan: plan._id,
//             name,
//             age,
//             email,
//             mobile_number,
//             gender,
//             paymentResult: paymentResult || { status: 'initiated' }
//         });

//         const merchantOrderId = booking._id.toString();
//         const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
//         const priceInPaise = Math.round((plan.price || 0) * 100);

//         const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
//             .merchantOrderId(merchantOrderId)
//             .amount(priceInPaise)
//             .redirectUrl(redirectUrl)
//             .build();

//         const paymentResponse = await client.pay(paymentRequest);

//         return res.status(201).json({
//             message: 'Membership booking initiated. Please complete payment.',
//             booking,
//             checkoutPageUrl: paymentResponse.redirectUrl
//         });
//     } catch (err) {
//         console.error('Create membership booking error:', err);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };

// exports.createBooking = async (req, res) => {
//     try {
//       const {
//         planId,
//         batch_id, // should be ObjectId string
//         billing_interval,
//         name,
//         age,
//         email,
//         mobile_number,
//         gender,
//         paymentResult
//       } = req.body;
  
//       // Validate
//       if (!isValidObjectId(planId))
//         return res.status(400).json({ error: 'Invalid planId' });
//       if (!isValidObjectId(batch_id))
//         return res.status(400).json({ error: 'Invalid batch_id' });
//       const validIntervals = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
//       if (!billing_interval || !validIntervals.includes(billing_interval))
//         return res.status(400).json({ error: 'Invalid billing_interval' });
//       if (!name || typeof name !== 'string')
//         return res.status(400).json({ error: 'Valid name is required' });
//       if (typeof age !== 'number' || age < 0)
//         return res.status(400).json({ error: 'Valid age is required' });
//       if (!email || typeof email !== 'string')
//         return res.status(400).json({ error: 'Valid email is required' });
//       if (!mobile_number || typeof mobile_number !== 'string')
//         return res.status(400).json({ error: 'Valid mobile_number is required' });
//       const allowedGenders = ['Male', 'Female', 'Other'];
//       if (!gender || !allowedGenders.includes(gender))
//         return res.status(400).json({ error: 'Valid gender is required' });
  
//       const plan = await MembershipPlan.findById(planId);
//       if (!plan || !plan.is_active)
//         return res.status(404).json({ error: 'Plan not found or inactive' });
//       const batch = plan.batches.id(batch_id);
//       if (!batch)
//         return res.status(400).json({ error: 'Batch not found in plan' });
//       if (batch.capacity !== undefined && batch.capacity <= 0)
//         return res.status(400).json({ error: 'Batch full' });
  
//       const price = plan.prices?.[billing_interval];
//       if (price === undefined || price < 0)
//         return res.status(400).json({ error: `Invalid price for ${billing_interval}` });
//     const totalprice = price +500
//       const priceInPaise = Math.round(totalprice * 100) ;
    
//       // Create booking, store batchId
//       const booking = await MembershipBooking.create({
//         plan: plan._id,
//         batchId: batch._id, // important!
//         billing_interval,
//         name,
//         age,
//         email,
//         mobile_number,
//         gender,
//         paymentResult: paymentResult || { status: 'initiated' }
//       });
  
//       const merchantOrderId = booking._id.toString();

//       const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
  
//       const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
//         .merchantOrderId(merchantOrderId)
//         .amount(priceInPaise)
//         .redirectUrl(redirectUrl)
//         .build();
  
//       const paymentResponse = await client.pay(paymentRequest);
//       res.status(201).json({
//         message: 'Booking initiated, complete payment.',
//         booking,
//         checkoutPageUrl: paymentResponse.redirectUrl
//       });
//     } catch (err) {
//       console.error('createBooking:', err);
//       res.status(500).json({ error: 'Server error' });
//     }
//   };

// // Check payment status and update booking, user, and batch capacity

// exports.checkMembershipStatus = async (req, res) => {
//   console.log('checkMembershipStatus invoked with query:', req.query);
//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId)
//       return res.status(400).send('merchantOrderId is required');

//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     const booking = await MembershipBooking.findById(merchantOrderId);
//     if (!booking)
//       return res.status(404).send('Booking not found');

//     if (status === 'COMPLETED') {
//       // User management
//       let user = await User.findOne({ 'email_data.email_id': booking.email });
//       if (!user) {
//         const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
//         const lastName = rest.join(' ');
//         const password = `${firstName || 'User'}@123`;
//         const hashedPassword = await bcrypt.hash(password, 10);

//         user = await User.create({
//           first_name: firstName || 'User',
//           last_name: lastName || '',
//           media: [],
//           email_data: { temp_email_id: booking.email, is_validated: true },
//           phone_data: { phone_number: booking.mobile_number, is_validated: true },
//           role: 'USER',
//           password: hashedPassword,
//           is_active: true,
//           is_archived: false
//         });
//       }

//       // Mark booking paid
//       await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
//         user: user._id,
//         'paymentResult.status': 'COMPLETED',
//         'paymentResult.paymentDate': new Date(),
//         'paymentResult.phonepeResponse': response
//       });

//       // Decrement capacity for the booked batch
//       const plan = await mongoose.model('membershipplan').findById(booking.plan);
//       if (plan && plan.batches && booking.batchId) {
//         plan.batches = plan.batches.map(batch => {
//           if (
//             batch._id.toString() === booking.batchId.toString() &&
//             batch.capacity !== undefined &&
//             batch.capacity > 0
//           ) {
//             batch.capacity -= 1;
//           }
//           return batch;
//         });
//         await plan.save();
//       } else {
//         console.log('Missing plan or batchId, capacity not decremented');
//       }
//       return res.redirect(`https://www.thedancedistrict.in/payment-success`);

//     //   return res.redirect('http://localhost:5173/payment-success');
//     } else {
//       // Payment failure
//       await mongoose.model('membershipbooking').findByIdAndUpdate(merchantOrderId, {
//         'paymentResult.status': 'FAILED',
//         'paymentResult.phonepeResponse': response
//       });
//       return res.redirect(`https://www.thedancedistrict.in/payment-failure`);

//     //   return res.redirect('http://localhost:5173/payment-failure');
//     }
//   } catch (err) {
//     console.error('checkMembershipStatus:', err);
//     res.status(500).send('Internal server error');
//   }
// };


exports.createBooking = async (req, res) => {
    try {
      const {
        planId,
        batch_id, // should be ObjectId string
        billing_interval,
        name,
        age,
        email,
        mobile_number,
        gender,
        paymentResult
      } = req.body;
  
      // Validate
      if (!isValidObjectId(planId))
        return res.status(400).json({ error: 'Invalid planId' });
      if (!isValidObjectId(batch_id))
        return res.status(400).json({ error: 'Invalid batch_id' });
      const validIntervals = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
      if (!billing_interval || !validIntervals.includes(billing_interval))
        return res.status(400).json({ error: 'Invalid billing_interval' });
      if (!name || typeof name !== 'string')
        return res.status(400).json({ error: 'Valid name is required' });
      if (typeof age !== 'number' || age < 0)
        return res.status(400).json({ error: 'Valid age is required' });
      if (!email || typeof email !== 'string')
        return res.status(400).json({ error: 'Valid email is required' });
      if (!mobile_number || typeof mobile_number !== 'string')
        return res.status(400).json({ error: 'Valid mobile_number is required' });
      const allowedGenders = ['Male', 'Female', 'Other'];
      if (!gender || !allowedGenders.includes(gender))
        return res.status(400).json({ error: 'Valid gender is required' });
  
      const plan = await MembershipPlan.findById(planId);
      if (!plan || !plan.is_active)
        return res.status(404).json({ error: 'Plan not found or inactive' });
      const batch = plan.batches.id(batch_id);
      if (!batch)
        return res.status(400).json({ error: 'Batch not found in plan' });
      if (batch.capacity !== undefined && batch.capacity <= 0)
        return res.status(400).json({ error: 'Batch full' });
  
      const price = plan.prices?.[billing_interval];
      if (price === undefined || price < 0)
        return res.status(400).json({ error: `Invalid price for ${billing_interval}` });
    const totalprice = price +500
      const priceInPaise = Math.round(totalprice * 100) ;
    
      // Create booking, store batchId
      const booking = await MembershipBooking.create({
        plan: plan._id,
        batchId: batch._id, // important!
        billing_interval,
        name,
        age,
        email,
        mobile_number,
        gender,
        paymentResult: paymentResult || { status: 'initiated' }
        // Note: user field will be set after payment success in checkMembershipStatus
      });
  
      const merchantOrderId = booking._id.toString();
      const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
      // const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`
      const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
        .merchantOrderId(merchantOrderId)
        .amount(priceInPaise)
        .redirectUrl(redirectUrl)
        .build();
  
      const paymentResponse = await client.pay(paymentRequest);
      res.status(201).json({
        message: 'Booking initiated, complete payment.',
        booking,
        checkoutPageUrl: paymentResponse.redirectUrl
      });
    } catch (err) {
      console.error('createBooking:', err);
      res.status(500).json({ error: 'Server error' });
    }
  };

// Check payment status and update booking, user, and batch capacity

// exports.checkMembershipStatus = async (req, res) => {
//   console.log('checkMembershipStatus invoked with query:', req.query);
//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId)
//       return res.status(400).send('merchantOrderId is required');

//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     const booking = await MembershipBooking.findById(merchantOrderId);
//     if (!booking)
//       return res.status(404).send('Booking not found');

//     if (status === 'COMPLETED') {
//       // User management
//       let user = await User.findOne({ 'email_data.email_id': booking.email });
//       if (!user) {
//         const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
//         const lastName = rest.join(' ');
//         const password = `${firstName || 'User'}@123`;
//         const hashedPassword = await bcrypt.hash(password, 10);

//         user = await User.create({
//           first_name: firstName || 'User',
//           last_name: lastName || '',
//           media: [],
//           email_data: { temp_email_id: booking.email, is_validated: true },
//           phone_data: { phone_number: booking.mobile_number, is_validated: true },
//           role: 'USER',
//           password: hashedPassword,
//           is_active: true,
//           is_archived: false
//         });
//       }

//       // Mark booking paid
//       await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
//         user: user._id,
//         'paymentResult.status': 'COMPLETED',
//         'paymentResult.paymentDate': new Date(),
//         'paymentResult.phonepeResponse': response
//       });

//       // Decrement capacity for the booked batch
//       const plan = await mongoose.model('membershipplan').findById(booking.plan);
//       if (plan && plan.batches && booking.batchId) {
//         plan.batches = plan.batches.map(batch => {
//           if (
//             batch._id.toString() === booking.batchId.toString() &&
//             batch.capacity !== undefined &&
//             batch.capacity > 0
//           ) {
//             batch.capacity -= 1;
//           }
//           return batch;
//         });
//         await plan.save();
//       } else {
//         console.log('Missing plan or batchId, capacity not decremented');
//       }

//       return res.redirect('https://www.thedancedistrict.in/payment-success');
//     } else {
//       // Payment failure
//       await mongoose.model('membershipbooking').findByIdAndUpdate(merchantOrderId, {
//         'paymentResult.status': 'FAILED',
//         'paymentResult.phonepeResponse': response
//       });
//       return res.redirect('https://www.thedancedistrict.in/payment-failure');
//     }
//   } catch (err) {
//     console.error('checkMembershipStatus:', err);
//     res.status(500).send('Internal server error');
//   }
// };


exports.checkMembershipStatus = async (req, res) => {
  console.log('checkMembershipStatus invoked with query:', req.query);
  try {
    const { merchantOrderId } = req.query;
    if (!merchantOrderId)
      return res.status(400).send('merchantOrderId is required');

    // Get payment status from PhonePe
    const response = await client.getOrderStatus(merchantOrderId);
    const status = response.state;

    const booking = await MembershipBooking.findById(merchantOrderId).populate('plan').lean();
    if (!booking)
      return res.status(404).send('Booking not found');

    if (status === 'COMPLETED') {
      console.log('Payment completed for booking:', merchantOrderId);
      console.log('Booking user field:', booking.user);
      
      // Check if this is a renewal by checking if booking already has a user
      if (booking.user) {
        // This is a renewal - user already exists, just update the booking
        console.log('Renewal detected - updating existing user:', booking.user);
        console.log('Updating renewal booking with payment success...');
        
        // Calculate new end date based on billing interval
        const billingInterval = booking.billing_interval;
        const monthsToAdd = INTERVAL_TO_MONTHS[billingInterval] || 1;
        const newStartDate = new Date();
        const newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + monthsToAdd);
        
        await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
          'paymentResult.status': 'COMPLETED',
          'paymentResult.paymentDate': new Date(),
          'paymentResult.phonepeResponse': response,
          start_date: newStartDate, // Update start date to payment success date
          end_date: newEndDate // Update end date based on billing interval
        });
        
        console.log('Renewal booking updated successfully');
        console.log('User ID remains:', booking.user);
      } else {
        // This is a new booking - create or find user
        console.log('New booking detected - creating/finding user for email:', booking.email);
        let user = await User.findOne({ 'email_data.email_id': booking.email });
        console.log('Found existing user:', user ? user._id : 'None');
        
        if (!user) {
          console.log('Creating new user for:', booking.email);
          const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
          const lastName = rest.join(' ');
          const password = `${firstName || 'User'}@123`;
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await User.create({
            first_name: firstName || 'User',
            last_name: lastName || 'User', // Set default if empty
            media: [],
            email_data: { temp_email_id: booking.email, is_validated: true },
            phone_data: { phone_number: booking.mobile_number, is_validated: true },
            role: 'USER',
            password: hashedPassword,
            is_active: true,
            is_archived: false
          });
          console.log('New user created:', user._id);
        }

        // Update booking with user and payment details
        console.log('Updating booking with user:', user._id);
        await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
          user: user._id,
          'paymentResult.status': 'COMPLETED',
          'paymentResult.paymentDate': new Date(),
          'paymentResult.phonepeResponse': response
        });
        console.log('Booking updated successfully with user');
      }

      // Decrement batch capacity in plan
      const planDoc = await mongoose.model('membershipplan').findById(booking.plan._id);
      if (planDoc && planDoc.batches && booking.batchId) {
        planDoc.batches = planDoc.batches.map(batch => {
          if (
            batch._id.toString() === booking.batchId.toString() &&
            batch.capacity !== undefined &&
            batch.capacity > 0
          ) {
            batch.capacity -= 1;
          }
          return batch;
        });
        await planDoc.save();
      } else {
        console.log('Missing plan or batchId, capacity not decremented');
      }

      // Prepare WhatsApp message details
      let mobileNumber = booking.mobile_number?.toString().trim() || '';
      if (mobileNumber) {
        const digits = mobileNumber.replace(/\D/g, '');
        if (digits.length === 10) mobileNumber = `+91${digits}`;
        else if (digits.startsWith('91') && digits.length === 12) mobileNumber = `+${digits}`;
        else if (!mobileNumber.startsWith('+')) mobileNumber = `+${digits}`;
      }
      console.log('booking membership', booking);
const dancerName = booking.name || 'Participant';
const membershipPlan = booking.plan?.name || 'Membership Plan';

const billingIntervalMonthsMap = {
  MONTHLY: 1,
  '3_MONTHS': 3,
  '6_MONTHS': 6,
  YEARLY: 12,
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

// Get batch start date (assuming batch has a `startDate` ISO string field)
const batch = booking.plan.batches.find(b => b._id.toString() === booking.batchId.toString());
const batchStartDate = batch?.startDate || booking.start_date || new Date();

const monthsToAdd = billingIntervalMonthsMap[booking.billing_interval] || 1;

const startDate = new Date(batchStartDate);
const expiryDate = new Date(startDate);
expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);

// Format dates as dd/mm/yyyy
const formattedStartDate = startDate.toLocaleDateString('en-GB');
const formattedExpiryDate = expiryDate.toLocaleDateString('en-GB');

const contactNo = '+91 8073139244';

const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || '473576AtOfLQYl68f619aaP1';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '15558600955';

const messagePayload = {
  integrated_number: WHATSAPP_NUMBER,
  content_type: "template",
  payload: {
    messaging_product: "whatsapp",
    type: "template",
    template: {
      name: "membership_confirmation",
      language: { code: "en", policy: "deterministic" },
      namespace: "757345ed_855e_4856_b51f_06bc7bcfb953",
      to_and_components: [
        {
          to: [mobileNumber],
          components: {
            body_1: { type: "text", value: dancerName },
            body_2: { type: "text", value: membershipPlan },
            body_3: { type: "text", value: formattedStartDate },
            body_4: { type: "text", value: formattedExpiryDate },
            body_5: { type: "text", value: contactNo }
          }
        }
      ]
    }
  }
};


      // Send WhatsApp message
      try {
        const axiosResponse = await axios.post(
          'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
          messagePayload,
          {
            headers: {
              authkey: '473576AtOfLQYl68f619aaP1',
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          }
        );
        console.log('WhatsApp message sent response:', axiosResponse.data);
      } catch (whatsappError) {
        console.error(
          'Failed to send WhatsApp message:',
          whatsappError.response?.data || whatsappError.message || whatsappError
        );
      }

      // Redirect to success page
      return res.redirect('https://www.thedancedistrict.in/payment-success');
      // return res.redirect(`http://localhost:5173/payment-success`);


    } else {
      // Payment failed
      await mongoose.model('membershipbooking').findByIdAndUpdate(merchantOrderId, {
        'paymentResult.status': 'FAILED',
        'paymentResult.phonepeResponse': response
      });
      return res.redirect('https://www.thedancedistrict.in/payment-failure');
      // return res.redirect(`http://localhost:5173/payment-failure`);

    }
  } catch (err) {
    console.error('checkMembershipStatus:', err);
    return res.status(500).send('Internal server error');
  }
};

// exports.checkMembershipStatus = async (req, res) => {
//   console.log('checkMembershipStatus invoked with query:', req.query);
//   try {
//     const { merchantOrderId } = req.query;
//     if (!merchantOrderId)
//       return res.status(400).send('merchantOrderId is required');

//     // Check payment status from PhonePe
//     const response = await client.getOrderStatus(merchantOrderId);
//     const status = response.state;

//     const booking = await MembershipBooking.findById(merchantOrderId);
//     if (!booking)
//       return res.status(404).send('Booking not found');

//     if (status === 'COMPLETED') {
//       // Create or find a user
//       let user = await User.findOne({ 'email_data.email_id': booking.email });
//       if (!user) {
//         const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
//         const lastName = rest.join(' ');
//         const password = `${firstName || 'User'}@123`;
//         const hashedPassword = await bcrypt.hash(password, 10);

//         user = await User.create({
//           first_name: firstName || 'User',
//           last_name: lastName || '',
//           media: [],
//           email_data: { temp_email_id: booking.email, is_validated: true },
//           phone_data: { phone_number: booking.mobile_number, is_validated: true },
//           role: 'USER',
//           password: hashedPassword,
//           is_active: true,
//           is_archived: false
//         });
//       }

//       // Update booking with payment info and reference user
//       await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
//         user: user._id,
//         'paymentResult.status': 'COMPLETED',
//         'paymentResult.paymentDate': new Date(),
//         'paymentResult.phonepeResponse': response
//       });

//       // Decrement batch capacity
//       const plan = await MembershipPlan.findById(booking.plan);
//       if (plan && plan.batches && booking.batchId) {
//         plan.batches = plan.batches.map(batch => {
//           if (
//             batch._id.toString() === booking.batchId.toString() &&
//             batch.capacity !== undefined &&
//             batch.capacity > 0
//           ) {
//             batch.capacity -= 1;
//           }
//           return batch;
//         });
//         await plan.save();
//       } else {
//         console.log('Missing plan or batchId, capacity not decremented');
//       }

//       // Redirect to success page
//       return res.redirect('https://www.thedancedistrict.in/payment-success');

//     } else {
//       // Mark payment as failed
//       await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
//         'paymentResult.status': 'FAILED',
//         'paymentResult.phonepeResponse': response
//       });
//       return res.redirect('https://www.thedancedistrict.in/payment-failure');
//     }
//   } catch (err) {
//     console.error('checkMembershipStatus:', err);
//     return res.status(500).send('Internal server error');
//   }
// }

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
// exports.renewMembership = async (req, res) => {
//     try {
//       const { membershipBookingId } = req.params;
//       const { planId, userId, batchId } = req.body;
  
//       // Validate IDs
//       if (!isValidObjectId(membershipBookingId)) {
//         return res.status(400).json({ error: 'Invalid membership booking ID' });
//       }
//       if (!planId || !isValidObjectId(planId)) {
//         return res.status(400).json({ error: 'Valid planId is required' });
//       }
//       if (!userId || !isValidObjectId(userId)) {
//         return res.status(400).json({ error: 'Valid userId is required' });
//       }
//       if (!batchId || !isValidObjectId(batchId)) {
//         return res.status(400).json({ error: 'Valid batchId is required' });
//       }
  
//       // Find existing booking and check expiry
//       const existingBooking = await MembershipBooking.findById(membershipBookingId).lean();
//       if (!existingBooking) {
//         return res.status(404).json({ error: 'Membership booking not found' });
//       }
//       const now = new Date();
//       if (existingBooking.end_date && existingBooking.end_date > now) {
//         return res.status(400).json({ error: 'Membership is not expired yet' });
//       }
  
//       // Fetch new plan and batch to validate existence and capacity
//       const newPlan = await MembershipPlan.findById(planId).lean();
//       if (!newPlan || !newPlan.is_active) {
//         return res.status(404).json({ error: 'Membership plan not found or inactive' });
//       }
//       const batch = newPlan.batches.find(b => b._id.toString() === batchId);
//       if (!batch) {
//         return res.status(400).json({ error: 'Selected batch not found in the membership plan' });
//       }
//       if (batch.capacity !== undefined && batch.capacity <= 0) {
//         return res.status(400).json({ error: 'Selected batch is full' });
//       }
  
//       // Calculate new membership end date based on plan's billing interval
//       const INTERVAL_TO_MONTHS = {
//         MONTHLY: 1,
//         '3_MONTHS': 3,
//         '6_MONTHS': 6,
//         YEARLY: 12
//       };
//       const interval = (newPlan.billing_interval || 'MONTHLY').toUpperCase();
//       const monthsToAdd = INTERVAL_TO_MONTHS[interval] || 1;
//       const startDate = existingBooking.end_date || new Date();
//       const endDate = new Date(startDate);
//       endDate.setMonth(endDate.getMonth() + monthsToAdd);
  
//       // Create renewed booking
//       const renewalBooking = await MembershipBooking.create({
//         user: userId,
//         plan: newPlan._id,
//         batchId: batch._id,
//         name: existingBooking.name,
//         age: existingBooking.age,
//         email: existingBooking.email,
//         mobile_number: existingBooking.mobile_number,
//         gender: existingBooking.gender,
//         start_date: startDate,
//         end_date: endDate,
//         paymentResult: { status: 'initiated' }
//       });
  
//       const merchantOrderId = renewalBooking._id.toString();
//       const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
  
//       // Calculate price without additional fees for renewals, convert to paise
//       const priceRaw = newPlan.prices?.[interval.toLowerCase()] || 0;
//       const priceInPaise = Math.round(priceRaw * 100);
  
//       // Build payment request
//       const paymentRequest = StandardCheckoutPayRequest.builder(merchantOrderId)
//           .merchantOrderId(merchantOrderId)
//           .amount(priceInPaise)
//           .redirectUrl(redirectUrl)
//           .build();
  
//       const paymentResponse = await client.pay(paymentRequest);
  
//       return res.status(201).json({
//         message: 'Membership renewal initiated. Please complete payment.',
//         renewalBooking,
//         checkoutPageUrl: paymentResponse.redirectUrl
//       });
  
//     } catch (err) {
//       console.error('Renew membership error:', err);
//       return res.status(500).json({ error: 'Server error' });
//     }
//   };
//   exports.getConfirmedMembershipBookings = async (req, res) => {
//     try {
//       const { planId, batchId } = req.params;
  
//       if (!isValidObjectId(planId)) {
//         return res.status(400).json({ error: 'Invalid planId' });
//       }
  
//       if (!isValidObjectId(batchId)) {
//         return res.status(400).json({ error: 'Invalid batchId' });
//       }
  
//       const bookings = await MembershipBooking.find({
//         plan: planId,
//         batchId: batchId,
//         // Add any status filter if applicable here
//       })
//         .populate('user')
//         .populate('plan')
//         .sort({ createdAt: -1 });
  
//       return res.status(200).json({ confirmedMembershipBookings: bookings });
//     } catch (error) {
//       console.error('Error fetching confirmed membership bookings:', error);
//       return res.status(500).json({ error: 'Server error' });
//     }
//   };
  

const INTERVAL_TO_MONTHS = {
  MONTHLY: 1,
  '3_MONTHS': 3,
  '6_MONTHS': 6,
  YEARLY: 12
};

// Map common alternative names to schema's values
const FRONTEND_INTERVAL_MAP = {
  monthly: 'MONTHLY',
  quarterly: '3_MONTHS',
  half_yearly: '6_MONTHS',
  yearly: 'YEARLY',
  '3_months': '3_MONTHS',
  '6_months': '6_MONTHS'
};

exports.renewMembership = async (req, res) => {
  try {
    const { membershipBookingId } = req.params;
    const { planId, userId, batchId, billing_interval, billingInterval } = req.body;

    // Use billingInterval or billing_interval from frontend, normalize
    let intervalInput = billingInterval || billing_interval || 'monthly';
    intervalInput = String(intervalInput).toLowerCase();

    // Map to backend required value
    let interval = FRONTEND_INTERVAL_MAP[intervalInput] || intervalInput.toUpperCase();
    const allowedIntervals = Object.keys(INTERVAL_TO_MONTHS);
    if (!allowedIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid billing_interval provided' });
    }

    // Validate IDs
    if (!isValidObjectId(membershipBookingId)) {
      return res.status(400).json({ error: 'Invalid membership booking ID' });
    }
    if (!planId || !isValidObjectId(planId)) {
      return res.status(400).json({ error: 'Valid planId is required' });
    }
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Valid userId is required' });
    }
    if (!batchId || !isValidObjectId(batchId)) {
      return res.status(400).json({ error: 'Valid batchId is required' });
    }

    // Find existing booking and check expiry
    const existingBooking = await MembershipBooking.findById(membershipBookingId).lean();
    if (!existingBooking) {
      return res.status(404).json({ error: 'Membership booking not found' });
    }
    const now = new Date();
    if (existingBooking.end_date && existingBooking.end_date > now) {
      return res.status(400).json({ error: 'Membership is not expired yet' });
    }

    // Check if there's already a pending renewal (payment initiated but not completed)
    // Allow renewal even if there's a pending payment - user might want to change plans or retry
    if (existingBooking.paymentResult && existingBooking.paymentResult.status === 'initiated') {
      console.log('Found existing initiated payment, allowing renewal to proceed...');
    }

    // Fetch new plan and batch to validate existence and capacity
    const newPlan = await MembershipPlan.findById(planId).lean();
    if (!newPlan || !newPlan.is_active) {
      return res.status(404).json({ error: 'Membership plan not found or inactive' });
    }
    const batch = newPlan.batches.find(b => b._id.toString() === batchId);
    if (!batch) {
      return res.status(400).json({ error: 'Selected batch not found in the membership plan' });
    }
    if (batch.capacity !== undefined && batch.capacity <= 0) {
      return res.status(400).json({ error: 'Selected batch is full' });
    }

    // Calculate new membership end date
    const monthsToAdd = INTERVAL_TO_MONTHS[interval] || 1;
    const startDate = existingBooking.end_date || new Date();
    const effectiveStartDate = startDate > now ? startDate : now;
    const endDate = new Date(effectiveStartDate);
    endDate.setMonth(endDate.getMonth() + monthsToAdd);

     // Calculate price without additional fees for renewals, convert to paise
     // Map interval to correct price key
     let priceKey;
     switch (interval.toLowerCase()) {
       case 'monthly':
         priceKey = 'monthly';
         break;
       case '3_months':
         priceKey = 'quarterly';
         break;
       case '6_months':
         priceKey = 'half_yearly';
         break;
       case 'yearly':
         priceKey = 'yearly';
         break;
       default:
         priceKey = 'monthly'; // fallback
     }
     
     const priceRaw = newPlan.prices?.[priceKey] || newPlan.prices?.monthly || 0;
     
     // Ensure minimum amount for PhonePe (at least 1 paise = ₹0.01)
     if (priceRaw <= 0) {
       return res.status(400).json({ 
         error: 'Invalid plan price. Plan must have a valid price for renewal.',
         debug: {
           interval,
           prices: newPlan.prices,
           priceRaw
         }
       });
     }
     
     const priceInPaise = Math.round(priceRaw * 100);
     
     // Double check minimum amount
     if (priceInPaise < 1) {
       return res.status(400).json({ 
         error: 'Payment amount too low. Minimum amount is ₹0.01',
         debug: {
           priceRaw,
           priceInPaise
         }
       });
     }

    // Update existing booking for renewal (don't create new booking)
    console.log('Renewing membership for existing user:', userId);
    console.log('Updating booking:', membershipBookingId);
    
    const renewalBooking = await MembershipBooking.findByIdAndUpdate(
      membershipBookingId,
      {
        user: userId,
        plan: newPlan._id,
        batchId: batch._id,
        billing_interval: interval,
        paymentResult: { status: 'initiated' }
      },
      { new: true }
    );
    
    console.log('Renewal booking updated:', renewalBooking._id);
    console.log('User ID set to:', renewalBooking.user);

    const merchantOrderId = renewalBooking._id.toString();
    const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
    // const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`


    // Build payment request
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

  
  exports.getConfirmedMembershipBookings = async (req, res) => {
    try {
      const { planId, batchId } = req.params;
  
      if (!isValidObjectId(planId)) {
        return res.status(400).json({ error: 'Invalid planId' });
      }
  
      if (!isValidObjectId(batchId)) {
        return res.status(400).json({ error: 'Invalid batchId' });
      }
  
      const bookings = await MembershipBooking.find({
        plan: planId,
        batchId: batchId
        // Add status filter here if your schema supports it
      })
        .populate('user')
        .populate('plan')
        .sort({ createdAt: -1 });
  
      // Calculate end_date if not set, based on plan billing_interval
      const bookingsWithCalculatedEndDate = bookings.map(booking => {
        if (!booking.end_date && booking.plan && booking.plan.billing_interval) {
          const start = booking.start_date ? new Date(booking.start_date) : new Date();
          const monthsToAdd = INTERVAL_TO_MONTHS[booking.plan.billing_interval] || 0;
          const calculatedEndDate = new Date(start);
          calculatedEndDate.setMonth(calculatedEndDate.getMonth() + monthsToAdd);
          booking.end_date = calculatedEndDate;
        }
        return booking;
      });
  
      return res.status(200).json({ confirmedMembershipBookings: bookingsWithCalculatedEndDate });
    } catch (error) {
      console.error('Error fetching confirmed membership bookings:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  exports.getAdminBookingSummary = async (req, res) => {
    try {
      // Get bookings grouped by batchId (with populated batch info)
      const batches = await MembershipBooking.aggregate([
        {
          $group: {
            _id: '$batchId',
            bookings: { $push: '$$ROOT' }
          }
        }
      ]);
  
      // Get bookings grouped by membership plan name
      const memberships = await MembershipBooking.aggregate([
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
          $group: {
            _id: '$planInfo.name',
            bookings: { $push: '$$ROOT' }
          }
        }
      ]);
  
      res.json({
        batches,
        memberships
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

// exports.getAllMembershipBookings = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, status, planId, userId, batchId, search } = req.query;
//     const skip = (page - 1) * limit;

//     // Build match filter for aggregation
//     const matchFilter = {};
    
//     if (status) {
//       matchFilter['paymentResult.status'] = status;
//     }
    
//     if (planId && isValidObjectId(planId)) {
//       matchFilter.plan = new mongoose.Types.ObjectId(planId);
//     }
    
//     if (userId && isValidObjectId(userId)) {
//       matchFilter.user = new mongoose.Types.ObjectId(userId);
//     }
    
//     if (batchId && isValidObjectId(batchId)) {
//       matchFilter.batchId = new mongoose.Types.ObjectId(batchId);
//     }

//     // Aggregation pipeline
//     const pipeline = [
//       // Match stage
//       { $match: matchFilter },
      
//       // Lookup user data
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'user',
//           foreignField: '_id',
//           as: 'userData',
//           pipeline: [
//             {
//               $project: {
//                 first_name: 1,
//                 last_name: 1,
//                 'email_data.temp_email_id': 1,
//                 'phone_data.phone_number': 1
//               }
//             }
//           ]
//         }
//       },
      
//       // Lookup plan data
//       {
//         $lookup: {
//           from: 'membershipplans',
//           localField: 'plan',
//           foreignField: '_id',
//           as: 'planData',
//           pipeline: [
//             {
//               $project: {
//                 name: 1,
//                 price: 1,
//                 billing_interval: 1,
//                 plan_for: 1
//               }
//             }
//           ]
//         }
//       },
      
//       // Add fields to reshape the data
//       {
//         $addFields: {
//           user: { $arrayElemAt: ['$userData', 0] },
//           plan: { $arrayElemAt: ['$planData', 0] }
//         }
//       },
      
//       // Remove the temporary arrays
//       {
//         $unset: ['userData', 'planData']
//       }
//     ];

//     // Add search functionality if search query is provided
//     if (search && search.trim()) {
//       const searchRegex = new RegExp(search.trim(), 'i');
//       pipeline.push({
//         $match: {
//           $or: [
//             { name: searchRegex },
//             { email: searchRegex },
//             { mobile_number: searchRegex },
//             { 'user.first_name': searchRegex },
//             { 'user.last_name': searchRegex },
//             { 'user.email_data.temp_email_id': searchRegex },
//             { 'user.phone_data.phone_number': searchRegex },
//             { 'plan.name': searchRegex }
//           ]
//         }
//       });
//     }
    
//     // Add sorting
//     pipeline.push({ $sort: { createdAt: -1 } });
    
//     // Add facet for pagination and total count
//     pipeline.push({
//       $facet: {
//         bookings: [
//           { $skip: skip },
//           { $limit: parseInt(limit) }
//         ],
//         totalCount: [
//           { $count: 'count' }
//         ]
//       }
//     });

//     const result = await MembershipBooking.aggregate(pipeline);
    
//     const bookings = result[0].bookings;
//     const total = result[0].totalCount[0]?.count || 0;

//     // Calculate pagination info
//     const totalPages = Math.ceil(total / limit);
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     res.status(200).json({
//       success: true,
//       data: {
//         bookings,
//         pagination: {
//           currentPage: parseInt(page),
//           totalPages,
//           totalItems: total,
//           itemsPerPage: parseInt(limit),
//           hasNextPage,
//           hasPrevPage
//         },
//         filters: {
//           status: status || null,
//           planId: planId || null,
//           userId: userId || null,
//           batchId: batchId || null,
//           search: search || null
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Error fetching membership bookings:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching membership bookings',
//       error: error.message
//     });
//   }
// };


exports.getAllMembershipBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, planId, userId, batchId, search } = req.query;
    const skip = (page - 1) * limit;

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
              $project: {
                first_name: 1,
                last_name: 1,
                email_data: 1,
                phone_data: 1
              }
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

    // Add search functionality AFTER lookups
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { mobile_number: searchRegex },
            { 'userInfo.first_name': searchRegex },
            { 'userInfo.last_name': searchRegex },
            { 'userInfo.email_data.temp_email_id': searchRegex },
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
          { $limit: parseInt(limit) }
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
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        filters: {
          status: status || null,
          planId: planId || null,
          userId: userId || null,
          batchId: batchId || null,
          search: search || null
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
              $project: {
                first_name: 1,
                last_name: 1,
                'email_data.temp_email_id': 1,
                'phone_data.phone_number': 1
              }
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
      email, 
      mobile_number, 
      gender, 
      billing_interval,
      payment_status,
      start_date,
      end_date
    } = req.body;

    // Validate required fields
    if (!planId || !name || !age || !email || !mobile_number || !gender || !billing_interval) {
      return res.status(400).json({ 
        success: false,
        error: 'Plan ID, name, age, email, mobile number, gender, and billing interval are required' 
      });
    }

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
      const monthsToAdd = INTERVAL_TO_MONTHS[billing_interval] || 1;
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + monthsToAdd);
    }

    // Create the booking
    const bookingData = {
      plan: planId,
      batchId: batchId || null,
      user: userId || null,
      name,
      age,
      email,
      mobile_number,
      gender,
      billing_interval,
      start_date: startDate,
      end_date: endDate,
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
    if (updateData.billing_interval) updateFields.billing_interval = updateData.billing_interval;
    if (updateData.start_date) updateFields.start_date = new Date(updateData.start_date);
    if (updateData.end_date) updateFields.end_date = new Date(updateData.end_date);
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