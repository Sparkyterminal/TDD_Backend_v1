const mongoose = require('mongoose');
const MembershipPlan = require('../../modals/MembershipPlans');

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
        const { name, description, price, billing_interval, benefits, is_active } = req.body;

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

        const plan = await MembershipPlan.create({
            name,
            description,
            price,
            billing_interval: billing_interval || 'MONTHLY',
            benefits: benefits || [],
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
            q
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

        const allowed = ['name', 'description', 'price', 'billing_interval', 'benefits', 'is_active'];
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


