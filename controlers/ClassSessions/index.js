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

        // Check capacity and decrement atomically
        if (typeof session.capacity === 'number') {
            const updatedSession = await ClassSession.findOneAndUpdate(
                { 
                    _id: classSessionId, 
                    capacity: { $gt: 0 },
                    is_cancelled: false 
                },
                { $inc: { capacity: -1 } },
                { new: true }
            );
            
            if (!updatedSession) {
                return res.status(400).json({ error: 'No seats available for this session or session is cancelled' });
            }
        }

        // Check for existing enrollment (active or cancelled)
        const existing = await Enrollment.findOne({ user_id: effectiveUserId, class_session_id: classSessionId });
        
        if (existing) {
            if (existing.status === 'CONFIRMED' || existing.status === 'PENDING') {
                // If user already has active enrollment, increment capacity back and return error
                if (typeof session.capacity === 'number') {
                    await ClassSession.findByIdAndUpdate(classSessionId, { $inc: { capacity: 1 } });
                }
                return res.status(409).json({ error: 'User already enrolled for this class session' });
            } else if (existing.status === 'CANCELLED') {
                // If user had cancelled enrollment, reactivate it
                const updatedEnrollment = await Enrollment.findByIdAndUpdate(
                    existing._id,
                    { 
                        status: 'CONFIRMED',
                        price_paid: price_paid ?? existing.price_paid ?? 0,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
                return res.status(200).json({ 
                    message: 'Enrollment reactivated successfully', 
                    enrollment: updatedEnrollment 
                });
            }
        }

        // Create new enrollment if no existing enrollment found
        const enrollment = await Enrollment.create({
            user_id: effectiveUserId,
            class_session_id: classSessionId,
            status: 'CONFIRMED',
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

        // Populate class type and instructors for client convenience
        const populated = await ClassSession.findById(newSession._id)
            .populate('class_type_id')
            .populate('instructor_user_ids', '-password -__v')
            .lean();

        return res.status(201).json({ message: 'Class session created', session: populated });
    } catch (err) {
        console.error('Create class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};


// Admin: list/search class sessions
exports.getClassSessionsAdmin = async (req, res) => {
    try {
        // const token = req.get('Authorization');
        // const decoded = token ? jwt.decode(token) : null;
        // if (!decoded || decoded.role !== 'ADMIN') {
        //     return res.status(401).json({ error: 'Unauthorized' });
        // }

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

        // NEW: class_type filter
        const classTypeId = req.query.class_type_id;
        if (classTypeId && mongoose.Types.ObjectId.isValid(classTypeId)) {
            match.class_type_id = new mongoose.Types.ObjectId(classTypeId);
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
            { $lookup: { from: 'classtypes', localField: 'class_type_id', foreignField: '_id', as: 'class_type' } },
            { $unwind: { path: '$class_type', preserveNullAndEmptyArrays: true } },
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

// Admin: update a class session
exports.updateClassSession = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid session id' });
        }

        const updates = {};

        if (req.body.class_type_id) {
            if (!isValidObjectId(req.body.class_type_id)) {
                return res.status(400).json({ error: 'Invalid class_type_id' });
            }
            updates.class_type_id = req.body.class_type_id;
        }
        if (req.body.class_name !== undefined) {
            if (!req.body.class_name) return res.status(400).json({ error: 'Valid class_name is required' });
            updates.class_name = req.body.class_name;
        }
        // Instructors
        if (req.body.instructor_user_ids || req.body.instructor_user_id) {
            const instructorIdsInput = Array.isArray(req.body.instructor_user_ids)
                ? req.body.instructor_user_ids
                : Array.isArray(req.body.instructor_user_id)
                    ? req.body.instructor_user_id
                    : [];
            if (!Array.isArray(instructorIdsInput) || instructorIdsInput.length === 0 || !instructorIdsInput.every(isValidObjectId)) {
                return res.status(400).json({ error: 'Valid instructor_user_ids array is required' });
            }
            updates.instructor_user_ids = instructorIdsInput;
        }

        // Date/time normalization
        const isTimeOnly = (v) => typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v);
        const toDate = (d, t) => {
            if (t === undefined) return undefined;
            if (isTimeOnly(t)) return new Date(`${d}T${t}`);
            return new Date(t);
        };

        let eventDate = undefined;
        if (req.body.date !== undefined) {
            if (!req.body.date || isNaN(Date.parse(req.body.date))) {
                return res.status(400).json({ error: 'Valid date is required' });
            }
            eventDate = new Date(req.body.date);
            updates.date = eventDate;
        }

        // For start/end, if time-only provided and date not provided in this request, we need existing date
        const existing = await ClassSession.findById(id).lean();
        if (!existing) return res.status(404).json({ error: 'Session not found' });
        const baseDateStr = (eventDate || existing.date).toISOString().slice(0, 10);

        if (req.body.start_at !== undefined) {
            const startDate = toDate(baseDateStr, req.body.start_at);
            if (isNaN(startDate?.getTime())) return res.status(400).json({ error: 'Valid start_at is required' });
            updates.start_at = startDate;
        }
        if (req.body.end_at !== undefined) {
            const endDate = toDate(baseDateStr, req.body.end_at);
            if (isNaN(endDate?.getTime())) return res.status(400).json({ error: 'Valid end_at is required' });
            updates.end_at = endDate;
        }

        if (updates.start_at && updates.end_at && updates.end_at <= updates.start_at) {
            return res.status(400).json({ error: 'end_at must be after start_at' });
        }

        if (req.body.capacity !== undefined) {
            const cap = Number(req.body.capacity);
            if (Number.isNaN(cap) || cap < 0) return res.status(400).json({ error: 'Invalid capacity' });
            updates.capacity = cap;
        }
        if (req.body.duration_minutes !== undefined) {
            const dur = Number(req.body.duration_minutes);
            if (Number.isNaN(dur) || dur < 0) return res.status(400).json({ error: 'Invalid duration_minutes' });
            updates.duration_minutes = dur;
        }

        // Conflict checks if any of time or instructors changed
        const startForCheck = updates.start_at || existing.start_at;
        const endForCheck = updates.end_at || existing.end_at;
        const instructorsForCheck = updates.instructor_user_ids || existing.instructor_user_ids || [];
        if (startForCheck && endForCheck && instructorsForCheck.length > 0) {
            const overlapping = await ClassSession.findOne({
                _id: { $ne: id },
                instructor_user_ids: { $in: instructorsForCheck },
                is_cancelled: false,
                start_at: { $lt: endForCheck },
                end_at: { $gt: startForCheck }
            }).lean();
            if (overlapping) {
                return res.status(409).json({ error: 'One or more instructors are unavailable for the selected time' });
            }
        }

        const updated = await ClassSession.findByIdAndUpdate(id, updates, { new: true });
        if (!updated) return res.status(404).json({ error: 'Session not found' });

        const populated = await ClassSession.findById(updated._id)
            .populate('class_type_id')
            .populate('instructor_user_ids', '-password -__v')
            .lean();
        return res.status(200).json({ message: 'Class session updated', session: populated });
    } catch (err) {
        console.error('Update class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// Admin: cancel a class session
exports.cancelClassSession = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid session id' });

        const updated = await ClassSession.findByIdAndUpdate(id, { is_cancelled: true }, { new: true }).lean();
        if (!updated) return res.status(404).json({ error: 'Session not found' });
        return res.status(200).json({ message: 'Class session cancelled', session: updated });
    } catch (err) {
        console.error('Cancel class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// Admin: get class session by id
exports.getClassSessionById = async (req, res) => {
    try {
        const token = req.get('Authorization');
        const decoded = token ? jwt.decode(token) : null;
        if (!decoded || decoded.role !== 'ADMIN') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!isValidObjectId(id)) return res.status(400).json({ error: 'Invalid session id' });

        const session = await ClassSession.findById(id)
            .populate('class_type_id')
            .populate('instructor_user_ids', '-password -__v')
            .lean();
        if (!session) return res.status(404).json({ error: 'Session not found' });
        return res.status(200).json({ session });
    } catch (err) {
        console.error('Get class session by id error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// User: get class sessions for a specific user
exports.getUserClassSessions = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const {
            page = '1',
            limit = '20',
            sortBy = 'start_at',
            sortOrder = 'asc',
            status, // enrollment status filter
            dateFrom,
            dateTo
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
        const sortDir = sortOrder === 'desc' ? -1 : 1;

        // Build enrollment match
        const enrollmentMatch = { user_id: new mongoose.Types.ObjectId(userId) };
        if (status && ['PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW'].includes(status)) {
            enrollmentMatch.status = status;
        }

        // Date filter on class session date
        const sessionDateMatch = {};
        if (dateFrom && !isNaN(Date.parse(dateFrom))) {
            const start = new Date(`${dateFrom}T00:00:00.000Z`);
            sessionDateMatch.date = { $gte: start };
        }
        if (dateTo && !isNaN(Date.parse(dateTo))) {
            const end = new Date(`${dateTo}T23:59:59.999Z`);
            sessionDateMatch.date = { $lte: end };
        }

        const allowedSortFields = new Set(['start_at', 'end_at', 'date', 'class_name', 'createdAt']);
        const sortField = allowedSortFields.has(sortBy) ? sortBy : 'start_at';

        const pipeline = [
            // Start with enrollments for this user
            { $match: enrollmentMatch },
            // Join with class sessions
            { $lookup: {
                from: 'classsessions',
                localField: 'class_session_id',
                foreignField: '_id',
                as: 'class_session'
            }},
            { $unwind: { path: '$class_session', preserveNullAndEmptyArrays: false } },
            // Apply date filters on class session
            ...(Object.keys(sessionDateMatch).length > 0 ? [{ $match: sessionDateMatch }] : []),
            // Join with class type and instructors
            { $lookup: {
                from: 'classtypes',
                localField: 'class_session.class_type_id',
                foreignField: '_id',
                as: 'class_type'
            }},
            { $unwind: { path: '$class_type', preserveNullAndEmptyArrays: true } },
            { $lookup: {
                from: 'users',
                localField: 'class_session.instructor_user_ids',
                foreignField: '_id',
                as: 'instructors'
            }},
            // Sort and paginate
            { $sort: { [`class_session.${sortField}`]: sortDir } },
            { $facet: {
                items: [
                    { $skip: (pageNum - 1) * limitNum },
                    { $limit: limitNum },
                    { $project: {
                        enrollment_id: '$_id',
                        status: '$status',
                        price_paid: '$price_paid',
                        attendance: '$attendance',
                        enrollment_created: '$createdAt',
                        class_session: {
                            id: '$class_session._id',
                            class_name: '$class_session.class_name',
                            date: '$class_session.date',
                            start_at: '$class_session.start_at',
                            end_at: '$class_session.end_at',
                            capacity: '$class_session.capacity',
                            duration_minutes: '$class_session.duration_minutes',
                            is_cancelled: '$class_session.is_cancelled',
                            class_type: '$class_type',
                            instructors: '$instructors'
                        }
                    }}
                ],
                totalCount: [{ $count: 'count' }]
            }}
        ];

        const result = await Enrollment.aggregate(pipeline);
        const items = result?.[0]?.items || [];
        const total = result?.[0]?.totalCount?.[0]?.count || 0;

        return res.status(200).json({
            items,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        console.error('Get user class sessions error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// User: cancel enrollment in a class session
exports.cancelEnrollment = async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { user_id } = req.body;

        if (!isValidObjectId(enrollmentId)) {
            return res.status(400).json({ error: 'Invalid enrollment ID' });
        }

        // Prefer authenticated user if available; fallback to body user_id
        const effectiveUserId = req.userId || user_id;
        if (!effectiveUserId || !isValidObjectId(effectiveUserId)) {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        // Find enrollment and verify ownership
        const enrollment = await Enrollment.findById(enrollmentId).lean();
        if (!enrollment) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        if (enrollment.user_id.toString() !== effectiveUserId.toString()) {
            return res.status(403).json({ error: 'Unauthorized to cancel this enrollment' });
        }

        if (enrollment.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Enrollment already cancelled' });
        }

        // Get class session to check capacity
        const session = await ClassSession.findById(enrollment.class_session_id).lean();
        if (!session) {
            return res.status(404).json({ error: 'Class session not found' });
        }

        // Update enrollment status
        const updatedEnrollment = await Enrollment.findByIdAndUpdate(
            enrollmentId,
            { status: 'CANCELLED' },
            { new: true }
        );

        // Increment capacity back if session has capacity tracking
        if (typeof session.capacity === 'number') {
            await ClassSession.findByIdAndUpdate(
                enrollment.class_session_id,
                { $inc: { capacity: 1 } }
            );
        }

        // Check if all enrollments are cancelled and mark session as cancelled
        const activeEnrollments = await Enrollment.countDocuments({
            class_session_id: enrollment.class_session_id,
            status: { $ne: 'CANCELLED' }
        });

        if (activeEnrollments === 0) {
            await ClassSession.findByIdAndUpdate(
                enrollment.class_session_id,
                { is_cancelled: true }
            );
        }

        return res.status(200).json({ 
            message: 'Enrollment cancelled successfully', 
            enrollment: updatedEnrollment 
        });
    } catch (err) {
        console.error('Cancel enrollment error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

// User: get count of confirmed classes for a user
exports.getUserConfirmedClassesCount = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!isValidObjectId(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const count = await Enrollment.countDocuments({
            user_id: new mongoose.Types.ObjectId(userId),
            status: 'CONFIRMED'
        });

        return res.status(200).json({ 
            userId,
            confirmedClassesCount: count 
        });
    } catch (err) {
        console.error('Get user confirmed classes count error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

