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
        if (!date || isNaN(Date.parse(date))) {
            return res.status(400).json({ error: 'Valid date is required' });
        }
        if (!start_at || isNaN(Date.parse(start_at))) {
            return res.status(400).json({ error: 'Valid start_at is required' });
        }
        if (!end_at || isNaN(Date.parse(end_at))) {
            return res.status(400).json({ error: 'Valid end_at is required' });
        }

        // Helpers: combine date with time-only values if needed
        const isTimeOnly = (v) => typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v);
        const toDate = (d, t) => {
            if (isTimeOnly(t)) return new Date(`${d}T${t}`);
            return new Date(t);
        };

        const eventDate = new Date(date);
        const startDate = toDate(date, start_at);
        const endDate = toDate(date, end_at);
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


