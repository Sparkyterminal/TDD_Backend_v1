const Workshop = require('../../modals/Workshops');
const mongoose = require('mongoose');

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

exports.createWorkshop = async (req, res) => {
    try {
      let {
        title,
        description,
        instructor_user_ids,
        instructor,
        media,
        image,
        date,
        start_time,
        end_time,
        capacity,
        price,
        tags,
        is_cancelled,
        is_active
      } = req.body;
  
      // Use image as media array if media not provided
      if (!media && image) {
        media = [image];
      }
  
      // Use instructor string as single-element array if instructor_user_ids not provided
      if (!instructor_user_ids && instructor) {
        instructor_user_ids = [instructor];
      }
  
      // Validate required fields
      if (!title || !date || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields: title, date, start_time, end_time' });
      }
  
      // Validate date and times
      if (isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (isNaN(Date.parse(start_time)) || isNaN(Date.parse(end_time))) {
        return res.status(400).json({ error: 'Invalid start_time or end_time format' });
      }
  
      // Validate instructor_user_ids and media as arrays if present
      if (instructor_user_ids && !Array.isArray(instructor_user_ids)) {
        return res.status(400).json({ error: 'instructor_user_ids must be an array of IDs' });
      }
      if (media && !Array.isArray(media)) {
        return res.status(400).json({ error: 'media must be an array of IDs' });
      }
  
      // Convert capacity and price to numbers if they are string
      if (capacity && typeof capacity === 'string') {
        capacity = parseInt(capacity, 10);
        if (isNaN(capacity)) capacity = undefined;
      }
      if (price && typeof price === 'string') {
        price = parseFloat(price);
        if (isNaN(price)) price = undefined;
      }
  
      const workshop = new Workshop({
        title,
        description,
        instructor_user_ids,
        media,
        date: new Date(date),
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        capacity,
        price,
        tags,
        is_cancelled: is_cancelled ?? false,
        is_active: is_active ?? true
      });
  
      await workshop.save();
      return res.status(201).json(workshop);
  
    } catch (err) {
      console.error('Create workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
  

exports.getWorkshop = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid workshop ID' });
        }

        const workshop = await Workshop.findById(id)
            .populate('instructor_user_ids', '-password -__v')
            .populate('media');

        if (!workshop) {
            return res.status(404).json({ error: 'Workshop not found' });
        }

        return res.json(workshop);
    } catch (err) {
        console.error('Get workshop error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getWorkshops = async (req, res) => {
    try {
        // Optionally add filters, pagination here
        const workshops = await Workshop.find()
            .populate('instructor_user_ids', '-password -__v')
            .populate('media')
            .sort({ start_at: 1 });
        return res.json(workshops);
    } catch (err) {
        console.error('Get workshops error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.updateWorkshop = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid workshop ID' });
      }
  
      const updateData = { ...req.body };
  
      if (updateData.date && isNaN(Date.parse(updateData.date))) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      if (updateData.start_time && isNaN(Date.parse(updateData.start_time))) {
        return res.status(400).json({ error: 'Invalid start_time format' });
      }
      if (updateData.end_time && isNaN(Date.parse(updateData.end_time))) {
        return res.status(400).json({ error: 'Invalid end_time format' });
      }
  
      // Convert to Date objects without renaming fields
      if (updateData.start_time) {
        updateData.start_time = new Date(updateData.start_time);
      }
      if (updateData.end_time) {
        updateData.end_time = new Date(updateData.end_time);
      }
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }
  
      const updatedWorkshop = await Workshop.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true
      });
  
      if (!updatedWorkshop) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
  
      return res.json(updatedWorkshop);
    } catch (err) {
      console.error('Update workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
  

exports.cancelWorkshop = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid workshop ID' });
      }
  
      const updatedWorkshop = await Workshop.findByIdAndUpdate(
        id,
        { is_cancelled: true, is_active: false }, // mark cancelled and optionally deactivate
        { new: true }
      );
  
      if (!updatedWorkshop) {
        return res.status(404).json({ error: 'Workshop not found' });
      }
  
      return res.json({
        message: 'Workshop cancelled successfully',
        workshop: updatedWorkshop
      });
    } catch (err) {
      console.error('Cancel workshop error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
