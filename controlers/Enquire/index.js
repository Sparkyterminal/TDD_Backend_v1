const Enquire = require('../../modals/Enquire');
const jwt = require("jsonwebtoken");

const parseToken = (req) => {
    const token = req.get("Authorization");
    return token ? jwt.decode(token) : null;
};

/**
 * Create a new enquiry
 */
const createEnquiry = async (req, res) => {
    try {
        const { name, phone_number, purpose } = req.body;
        if (!name || !phone_number || !purpose) {
            return res.status(400).json({ message: "name, phone_number, and purpose are required." });
        }

        const enquiry = new Enquire({
            name,
            phone_number,
            purpose
        });

        await enquiry.save();
        return res.status(201).json(enquiry.toJSON());
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const createAdminEnquiry = async (req, res) => {
    try {
        const decoded = parseToken(req);
        if (!decoded || decoded.role !== "ADMIN") {
            return res.status(403).json({ message: "Only admin can create admin enquiries." });
        }

        const { name, phone_number, purpose } = req.body;
        if (!name || !phone_number || !purpose) {
            return res.status(400).json({ message: "name, phone_number, and purpose are required." });
        }

        const enquiry = new Enquire({
            name,
            phone_number,
            purpose,
            source: "ADMIN",
        });

        await enquiry.save();
        return res.status(201).json(enquiry.toJSON());
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const updateAdminEnquiry = async (req, res) => {
    try {
        const decoded = parseToken(req);
        if (!decoded || decoded.role !== "ADMIN") {
            return res.status(403).json({ message: "Only admin can update admin enquiries." });
        }

        const { id } = req.params;
        const { name, phone_number, purpose } = req.body;
        if (!name || !phone_number || !purpose) {
            return res.status(400).json({ message: "name, phone_number, and purpose are required." });
        }

        const enquiry = await Enquire.findOne({ _id: id, source: "ADMIN" });
        if (!enquiry) {
            return res.status(404).json({ message: "Admin enquiry not found." });
        }

        enquiry.name = name;
        enquiry.phone_number = phone_number;
        enquiry.purpose = purpose;
        await enquiry.save();

        return res.status(200).json(enquiry.toJSON());
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * Get all enquiries (with optional filtering)
 */
const getEnquiries = async (req, res) => {
    try {
        const { source } = req.query;
        const query = {};
        if (source && ["PUBLIC", "ADMIN"].includes(String(source).toUpperCase())) {
            const normalizedSource = String(source).toUpperCase();
            if (normalizedSource === "PUBLIC") {
                // Backward compatibility: old enquiries may not have source.
                query.$or = [
                    { source: "PUBLIC" },
                    { source: { $exists: false } },
                    { source: null },
                ];
            } else {
                query.source = "ADMIN";
            }
        }
        const enquiries = await Enquire.find(query).sort({ createdAt: -1 });
        return res.status(200).json(enquiries.map(e => e.toJSON()));
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createEnquiry,
    createAdminEnquiry,
    updateAdminEnquiry,
    getEnquiries
};
