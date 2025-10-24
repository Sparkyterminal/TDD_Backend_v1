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
const env = Env.SANDBOX
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
      });
  
      const merchantOrderId = booking._id.toString();
      // const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
      const redirectUrl = `http://localhost:4044/membership-plan/check-status?merchantOrderId=${merchantOrderId}`
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
      // User creation or fetch
      let user = await User.findOne({ 'email_data.email_id': booking.email });
      if (!user) {
        const [firstName, ...rest] = (booking.name || '').trim().split(/\s+/);
        const lastName = rest.join(' ');
        const password = `${firstName || 'User'}@123`;
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await User.create({
          first_name: firstName || 'User',
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

      // Update booking with user and payment details
      await MembershipBooking.findByIdAndUpdate(merchantOrderId, {
        user: user._id,
        'paymentResult.status': 'COMPLETED',
        'paymentResult.paymentDate': new Date(),
        'paymentResult.phonepeResponse': response
      });

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
      // return res.redirect('https://www.thedancedistrict.in/payment-success');
      return res.redirect(`http://localhost:5173/payment-success`);


    } else {
      // Payment failed
      await mongoose.model('membershipbooking').findByIdAndUpdate(merchantOrderId, {
        'paymentResult.status': 'FAILED',
        'paymentResult.phonepeResponse': response
      });
      // return res.redirect('https://www.thedancedistrict.in/payment-failure');
      return res.redirect(`http://localhost:5173/payment-failure`);

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
  
//       // Calculate and add fixed Rs.500 fee, convert to paise
//       const priceRaw = newPlan.prices?.[interval.toLowerCase()] || 0;
//       const totalPrice = priceRaw + 500;
//       const priceInPaise = Math.round(totalPrice * 100);
  
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
  
  exports.renewMembership = async (req, res) => {
    try {
      const { membershipBookingId } = req.params;
      const { planId, userId, batchId, billingInterval } = req.body;
  
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
  
      // Validate billingInterval - make uppercase and check allowed intervals
      const allowedIntervals = ['MONTHLY', '3_MONTHS', '6_MONTHS', 'YEARLY'];
      const interval = (billingInterval || 'MONTHLY').toUpperCase();
      if (!allowedIntervals.includes(interval)) {
        return res.status(400).json({ error: 'Invalid billingInterval provided' });
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
  
      // Calculate new membership end date based on billingInterval
      const INTERVAL_TO_MONTHS = {
        MONTHLY: 1,
        '3_MONTHS': 3,
        '6_MONTHS': 6,
        YEARLY: 12
      };
      const monthsToAdd = INTERVAL_TO_MONTHS[interval] || 1;
      const startDate = existingBooking.end_date || new Date();
      // Defensive fix: if existing end_date is past, start now, else after existing end_date
      const effectiveStartDate = startDate > now ? startDate : now;
      const endDate = new Date(effectiveStartDate);
      endDate.setMonth(endDate.getMonth() + monthsToAdd);
  
      // Create renewed booking
      const renewalBooking = await MembershipBooking.create({
        user: userId,
        plan: newPlan._id,
        batchId: batch._id,
        name: existingBooking.name,
        age: existingBooking.age,
        email: existingBooking.email,
        mobile_number: existingBooking.mobile_number,
        gender: existingBooking.gender,
        start_date: effectiveStartDate,
        end_date: endDate,
        paymentResult: { status: 'initiated' }
      });
  
      const merchantOrderId = renewalBooking._id.toString();
      const redirectUrl = `https://www.thedancedistrict.in/api/membership-plan/check-status?merchantOrderId=${merchantOrderId}`;
  
      // Calculate and add fixed Rs.500 fee, convert to paise
      const priceRaw = newPlan.prices?.[interval.toLowerCase()] || 0;
      const totalPrice = priceRaw + 500;
      const priceInPaise = Math.round(totalPrice * 100);
  
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
      // Match stage
      { $match: matchFilter },
      
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
                name: 1,
                email: 1,
                mobile_number: 1
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

    // Add search functionality if search query is provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { mobile_number: searchRegex },
            { 'user.name': searchRegex },
            { 'user.email': searchRegex },
            { 'user.mobile_number': searchRegex },
            { 'plan.name': searchRegex }
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
                name: 1,
                email: 1,
                mobile_number: 1
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