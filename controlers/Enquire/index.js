const Enquire = require('../../modals/Enquire');

/**
 * Create a new enquiry
 */
const createEnquiry = async (req, res) => {
    try {
        const { name, phone_number, email_id, purpose } = req.body;
        if (!name || !phone_number || !purpose) {
            return res.status(400).json({ message: "name, phone_number, and purpose are required." });
        }

        const enquiry = new Enquire({
            name,
            phone_number,
            email_id,
            purpose
        });

        await enquiry.save();
        return res.status(201).json(enquiry.toJSON());
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * Get all enquiries (with optional filtering)
 */
const getEnquiries = async (req, res) => {
    try {
        const enquiries = await Enquire.find().sort({ createdAt: -1 });
        return res.status(200).json(enquiries.map(e => e.toJSON()));
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createEnquiry,
    getEnquiries
};
