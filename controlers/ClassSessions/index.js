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
            price_paid: price_paid ?? session.price_drop_in ?? 0
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
            instructor_user_id,
            space_id,
            start_at,
            end_at,
            capacity,
            price_drop_in,
            duration_minutes
        } = req.body;

        if (!class_type_id || !isValidObjectId(class_type_id)) {
            return res.status(400).json({ error: 'Valid class_type_id is required' });
        }
        if (!instructor_user_id || !isValidObjectId(instructor_user_id)) {
            return res.status(400).json({ error: 'Valid instructor_user_id is required' });
        }
        if (!space_id || !isValidObjectId(space_id)) {
            return res.status(400).json({ error: 'Valid space_id is required' });
        }
        if (!start_at || isNaN(Date.parse(start_at))) {
            return res.status(400).json({ error: 'Valid start_at is required' });
        }
        if (!end_at || isNaN(Date.parse(end_at))) {
            return res.status(400).json({ error: 'Valid end_at is required' });
        }

        const startDate = new Date(start_at);
        const endDate = new Date(end_at);
        if (endDate <= startDate) {
            return res.status(400).json({ error: 'end_at must be after start_at' });
        }

        const newSession = await ClassSession.create({
            class_type_id,
            instructor_user_id,
            space_id,
            start_at: startDate,
            end_at: endDate,
            capacity: capacity ?? undefined,
            price_drop_in: price_drop_in ?? undefined,
            duration_minutes: duration_minutes ?? undefined,
            is_cancelled: false
        });

        return res.status(201).json({ message: 'Class session created', session: newSession });
    } catch (err) {
        console.error('Create class session error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};


