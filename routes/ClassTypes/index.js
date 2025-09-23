const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const classTypeController = require("../../controlers/ClassTypes");

// Validation middleware
const validateClassType = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters"),
  body("level")
    .optional()
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'])
    .withMessage("Level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, ALL"),
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must not exceed 50 characters"),
  body("duration_minutes")
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage("Duration must be between 15 and 480 minutes"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters")
];

const validateUpdateClassType = [
  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters"),
  body("level")
    .optional()
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'])
    .withMessage("Level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, ALL"),
  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category must not exceed 50 characters"),
  body("duration_minutes")
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage("Duration must be between 15 and 480 minutes"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
  body("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active must be a boolean value")
];

const validateId = [
  param("id")
    .isMongoId()
    .withMessage("Invalid class type ID")
];

const validateCategory = [
  param("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters")
];

const validateLevel = [
  param("level")
    .trim()
    .notEmpty()
    .withMessage("Level is required")
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'])
    .withMessage("Level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, ALL")
];

const validatePagination = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must not exceed 100 characters"),
  query("level")
    .optional()
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL'])
    .withMessage("Level filter must be one of: BEGINNER, INTERMEDIATE, ADVANCED, ALL"),
  query("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category filter must not exceed 50 characters"),
  query("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active filter must be a boolean value")
];

// Routes

/**
 * @route   POST /api/class-types
 * @desc    Create a new class type
 * @access  Private (Admin/Coach)
 */
router.post(
  "/",
  isAuth,
  validateClassType,
  classTypeController.createClassType
);

/**
 * @route   GET /api/class-types
 * @desc    Get all class types with pagination and filtering
 * @access  Public
 */
router.get(
  "/",
  validatePagination,
  classTypeController.getClassTypes
);

/**
 * @route   GET /api/class-types/:id
 * @desc    Get a single class type by ID
 * @access  Public
 */
router.get(
  "/:id",
  validateId,
  classTypeController.getClassTypeById
);

/**
 * @route   PUT /api/class-types/:id
 * @desc    Update a class type
 * @access  Private (Admin/Coach)
 */
router.put(
  "/:id",
  isAuth,
  validateId,
  validateUpdateClassType,
  classTypeController.updateClassType
);

/**
 * @route   DELETE /api/class-types/:id
 * @desc    Soft delete a class type
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  isAuth,
  validateId,
  classTypeController.deleteClassType
);

/**
 * @route   GET /api/class-types/category/:category
 * @desc    Get class types by category
 * @access  Public
 */
router.get(
  "/category/:category",
  validateCategory,
  classTypeController.getClassTypesByCategory
);

/**
 * @route   GET /api/class-types/level/:level
 * @desc    Get class types by level
 * @access  Public
 */
router.get(
  "/level/:level",
  validateLevel,
  classTypeController.getClassTypesByLevel
);

module.exports = router;
