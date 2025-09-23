require("dotenv").config();

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");

const ClassType = require("../../modals/ClassTypes");
const { validationResult } = require("express-validator");

/**
 * Create a new class type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.createClassType = async (req, res) => {
  console.log('HEADERS:', req.headers);
  console.log('BODY:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Bad request",
      errors: errors.array()
    });
  }

  const { title, level, category, duration_minutes, description } = req.body;

  // Validate required fields
  if (!title || title.trim() === "") {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Title is required",
      field: "title"
    });
  }

  // Check if class type already exists
  try {
    const existingClassType = await ClassType.findOne({ 
      title: title.toLowerCase().trim(),
      is_active: true 
    });

    if (existingClassType) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: "Class type with this title already exists"
      });
    }

    const classType = new ClassType({
      title: title.toLowerCase().trim(),
      level: level || 'ALL',
      category: category ? category.toLowerCase().trim() : null,
      duration_minutes: duration_minutes || null,
      description: description ? description.trim() : null,
      is_active: true
    });

    const savedClassType = await classType.save();

    return res.status(STATUS.CREATED).json({
      message: "Class type created successfully",
      data: savedClassType
    });

  } catch (error) {
    console.error('Create ClassType Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all class types with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.getClassTypes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const level = req.query.level || '';
    const category = req.query.category || '';
    const is_active = req.query.is_active !== undefined ? req.query.is_active === 'true' : true;

    // Build filter object
    const filter = { is_active };
    
    if (search) {
      filter.$text = { $search: search };
    }
    
    if (level) {
      filter.level = level.toUpperCase();
    }
    
    if (category) {
      filter.category = category.toLowerCase();
    }

    const classTypes = await ClassType.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ClassType.countDocuments(filter);

    return res.status(STATUS.SUCCESS).json({
      message: "Class types retrieved successfully",
      data: {
        classTypes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });

  } catch (error) {
    console.error('Get ClassTypes Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get a single class type by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.getClassTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Class type ID is required"
      });
    }

    const classType = await ClassType.findById(id);

    if (!classType) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "Class type not found"
      });
    }

    return res.status(STATUS.SUCCESS).json({
      message: "Class type retrieved successfully",
      data: classType
    });

  } catch (error) {
    console.error('Get ClassType by ID Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a class type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.updateClassType = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Bad request",
      errors: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { title, level, category, duration_minutes, description, is_active } = req.body;

    if (!id) {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Class type ID is required"
      });
    }

    const classType = await ClassType.findById(id);

    if (!classType) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "Class type not found"
      });
    }

    // Check if title is being changed and if it already exists
    if (title && title.toLowerCase().trim() !== classType.title) {
      const existingClassType = await ClassType.findOne({ 
        title: title.toLowerCase().trim(),
        is_active: true,
        _id: { $ne: id }
      });

      if (existingClassType) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: "Class type with this title already exists"
        });
      }
    }

    // Update fields
    const updateData = {};
    if (title) updateData.title = title.toLowerCase().trim();
    if (level) updateData.level = level.toUpperCase();
    if (category !== undefined) updateData.category = category ? category.toLowerCase().trim() : null;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updatedClassType = await ClassType.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(STATUS.SUCCESS).json({
      message: "Class type updated successfully",
      data: updatedClassType
    });

  } catch (error) {
    console.error('Update ClassType Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Soft delete a class type (set is_active to false)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.deleteClassType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Class type ID is required"
      });
    }

    const classType = await ClassType.findById(id);

    if (!classType) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "Class type not found"
      });
    }

    // Soft delete by setting is_active to false
    await ClassType.findByIdAndUpdate(id, { is_active: false });

    return res.status(STATUS.SUCCESS).json({
      message: "Class type deleted successfully"
    });

  } catch (error) {
    console.error('Delete ClassType Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get class types by category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.getClassTypesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!category) {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Category is required"
      });
    }

    const classTypes = await ClassType.find({ 
      category: category.toLowerCase(),
      is_active: true 
    }).sort({ title: 1 });

    return res.status(STATUS.SUCCESS).json({
      message: "Class types retrieved successfully",
      data: classTypes
    });

  } catch (error) {
    console.error('Get ClassTypes by Category Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get class types by level
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports.getClassTypesByLevel = async (req, res) => {
  try {
    const { level } = req.params;

    if (!level) {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Level is required"
      });
    }

    const classTypes = await ClassType.find({ 
      level: level.toUpperCase(),
      is_active: true 
    }).sort({ title: 1 });

    return res.status(STATUS.SUCCESS).json({
      message: "Class types retrieved successfully",
      data: classTypes
    });

  } catch (error) {
    console.error('Get ClassTypes by Level Error:', error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
