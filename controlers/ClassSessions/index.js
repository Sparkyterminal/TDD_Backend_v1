const mongoose = require('mongoose');
const Enrollment = require('../../modals/Enrollments');
const ClassSession = require('../../modals/ClassSessions');
const jwt = require('jsonwebtoken');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// Enroll a user into a class session
exports.enrollInClassSession = async (req, res) => {
    try {
        const { classSessionId } = req.params;
        const { user_id, price_paid } = req.body;

        if (!isValidObjectId(classSessionId)) {
            return res.status(400).json({ error: 'Invalid classSessionId' });
        }

        // Prefer authenticated user if available; fallback to body user_id
        const effectiveUserId = req.userId || user_id;
        if (!effectiveUserId || !isValidObjectId(effectiveUserId)) {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        const session = await ClassSession.findById(classSessionId).lean();
        if (!session || session.is_cancelled) {
            return res.status(404).json({ error: 'Class session not found or cancelled' });
        }

        // Optional: check capacity if defined
        if (typeof session.capacity === 'number' && session.capacity <= 0) {
            return res.status(400).json({ error: 'No seats available for this session' });
        }

        // Prevent duplicate enrollment for same user and session
        const existing = await Enrollment.findOne({ user_id: effectiveUserId, class_session_id: classSessionId });
        if (existing) {
            return res.status(409).json({ error: 'User already enrolled for this class session' });
        }

        const enrollment = await Enrollment.create({
            user_id: effectiveUserId,
            class_session_id: classSessionId,
            status: 'PENDING',
            price_paid: price_paid ?? 0
        });

        return res.status(201).json({ message: 'Enrollment created', enrollment });
    } catch (err) {
        console.error('Enroll in class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// Admin: create a class session
exports.createClassSession = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            class_type_id,
            class_name,
            // space_id,
            date,
            start_at,
            end_at,
            capacity,
            duration_minutes
        } = req.body;
        const instructorIdsInput = Array.isArray(req.body.instructor_user_ids)
            ? req.body.instructor_user_ids
            : Array.isArray(req.body.instructor_user_id)
                ? req.body.instructor_user_id
                : [];

        if (!class_type_id || !isValidObjectId(class_type_id)) {
            return res.status(400).json({ error: 'Valid class_type_id is required' });
        }
        if (!Array.isArray(instructorIdsInput) || instructorIdsInput.length === 0 || !instructorIdsInput.every(isValidObjectId)) {
            return res.status(400).json({ error: 'Valid instructor_user_ids array is required' });
        }
        if (!class_name) {
            return res.status(400).json({ error: 'Valid class_name is required' });
        }
        // if (!space_id || !isValidObjectId(space_id)) {
        //     return res.status(400).json({ error: 'Valid space_id is required' });
        // }
        // Helpers: combine date with time-only values if needed
        const isTimeOnly = (v) => typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v);
        const toDate = (d, t) => {
            if (isTimeOnly(t)) return new Date(`${d}T${t}`);
            return new Date(t);
        };

        if (!date || isNaN(Date.parse(date))) {
            return res.status(400).json({ error: 'Valid date is required' });
        }
        if (!start_at) {
            return res.status(400).json({ error: 'Valid start_at is required' });
        }
        if (!end_at) {
            return res.status(400).json({ error: 'Valid end_at is required' });
        }

        const eventDate = new Date(date);
        const startDate = toDate(date, start_at);
        const endDate = toDate(date, end_at);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ error: 'Valid start_at is required' });
        }
        if (isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Valid end_at is required' });
        }
        if (endDate <= startDate) {
            return res.status(400).json({ error: 'end_at must be after start_at' });
        }

        // Check overlapping time for any of the instructors
        const overlappingInstructor = await ClassSession.findOne({
            instructor_user_ids: { $in: instructorIdsInput },
            is_cancelled: false,
            start_at: { $lt: endDate },
            end_at: { $gt: startDate }
        }).lean();
        if (overlappingInstructor) {
            return res.status(409).json({ error: 'One or more instructors are unavailable for the selected time' });
        }

        const newSession = await ClassSession.create({
            class_type_id,
            instructor_user_ids: instructorIdsInput,
            class_name,
            // space_id,
            date: eventDate,
            start_at: startDate,
            end_at: endDate,
            capacity: capacity ?? undefined,
            duration_minutes: duration_minutes ?? undefined,
            is_cancelled: false
        });

        return res.status(201).json({ message: 'Class session created', session: newSession });
    } catch (err) {
        console.error('Create class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};


// Admin: list/search class sessions
exports.getClassSessionsAdmin = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            page = '1',
            limit = '20',
            sortBy = 'date',
            sortOrder = 'asc',
            q,                    // class_name search
            instructorId,         // single id
            instructorIds,        // comma-separated ids
            date,                 // YYYY-MM-DD exact day
            dateFrom,             // inclusive start (YYYY-MM-DD)
            dateTo                // inclusive end (YYYY-MM-DD)
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const sortDir = sortOrder === 'desc' ? -1 : 1;

        const match = {};

        // Name search
        if (q && typeof q === 'string' && q.trim()) {
            match.class_name = { $regex: q.trim(), $options: 'i' };
        }

        // Instructor filter (ids)
        let instructorFilterIds = [];
        if (instructorId && mongoose.Types.ObjectId.isValid(instructorId)) {
            instructorFilterIds.push(new mongoose.Types.ObjectId(instructorId));
        }
        if (instructorIds && typeof instructorIds === 'string') {
            instructorIds.split(',')
                .map(s => s.trim())
                .filter(s => mongoose.Types.ObjectId.isValid(s))
                .forEach(s => instructorFilterIds.push(new mongoose.Types.ObjectId(s)));
        }
        if (instructorFilterIds.length > 0) {
            match.instructor_user_ids = { $in: instructorFilterIds };
        }

        // Date filter (on `date` field)
        const toDateOnly = (d) => new Date(`${d}T00:00:00.000Z`);
        if (date && !isNaN(Date.parse(date))) {
            const start = toDateOnly(date);
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 1);
            match.date = { $gte: start, $lt: end };
        } else {
            const hasFrom = dateFrom && !isNaN(Date.parse(dateFrom));
            const hasTo = dateTo && !isNaN(Date.parse(dateTo));
            if (hasFrom || hasTo) {
                match.date = {};
                if (hasFrom) match.date.$gte = toDateOnly(dateFrom);
                if (hasTo) {
                    const end = toDateOnly(dateTo);
                    end.setUTCDate(end.getUTCDate() + 1);
                    match.date.$lt = end;
                }
            }
        }

        const allowedSortFields = new Set(['date', 'start_at', 'end_at', 'class_name', 'createdAt']);
        const sortField = allowedSortFields.has(sortBy) ? sortBy : 'date';

        // Aggregation to support instructor name search (optional via instructorName)
        const pipeline = [
            { $match: match },
            { $lookup: { from: 'users', localField: 'instructor_user_ids', foreignField: '_id', as: 'instructors' } },
        ];

        // Optional instructor name search via ?instructorName=... (case-insensitive)
        const { instructorName } = req.query;
        if (instructorName && typeof instructorName === 'string' && instructorName.trim()) {
            const regex = new RegExp(instructorName.trim(), 'i');
            pipeline.push({ $match: { $or: [
                { 'instructors.first_name': regex },
                { 'instructors.last_name': regex },
                { 'instructors.email_data.temp_email_id': regex }
            ] } });
        }

        pipeline.push(
            { $sort: { [sortField]: sortDir } },
            { $facet: {
                items: [
                    { $skip: (pageNum - 1) * limitNum },
                    { $limit: limitNum },
                ],
                totalCount: [ { $count: 'count' } ]
            } }
        );

        const result = await ClassSession.aggregate(pipeline);
        const items = result?.[0]?.items || [];
        const total = result?.[0]?.totalCount?.[0]?.count || 0;

        return res.status(200).json({ items, page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Get class sessions (admin) error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

