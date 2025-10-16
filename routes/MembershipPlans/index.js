// const express = require('express');
// const router = express.Router();
// const { body, param, query } = require('express-validator');
// const plansController = require('../../controlers/MembershipPlans');


// // Validation middleware
// const validateMembershipPlan = [
//   body('name')
//     .trim()
//     .notEmpty()
//     .withMessage('Name is required')
//     .isLength({ min: 2, max: 100 })
//     .withMessage('Name must be between 2 and 100 characters'),
//   body('description')
//     .optional()
//     .trim()
//     .isLength({ max: 500 })
//     .withMessage('Description must not exceed 500 characters'),
//   body('prices')
//     .isObject()
//     .withMessage('Prices must be an object'),
//   body('prices.monthly')
//     .isFloat({ min: 0 })
//     .withMessage('Monthly price must be a non-negative number'),
//   body('prices.quarterly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Quarterly price must be a non-negative number'),
//   body('prices.half_yearly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Half yearly price must be a non-negative number'),
//   body('prices.yearly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Yearly price must be a non-negative number'),
//   body('dance_type')
//     .isMongoId()
//     .withMessage('Valid dance_type is required'),
//   body('plan_for')
//     .optional()
//     .isIn(['KID', 'KIDS', 'ADULT'])
//     .withMessage('Invalid plan_for'),
//   body('kids_category')
//     .optional()
//     .isIn(['JUNIOR', 'ADVANCED'])
//     .withMessage('Kids category must be JUNIOR or ADVANCED')
//     .custom((value, { req }) => {
//       if ((req.body.plan_for === 'KID' || req.body.plan_for === 'KIDS') && !value) {
//         throw new Error('Kids category is required for KID/KIDS plans');
//       }
//       if (req.body.plan_for === 'ADULT' && value) {
//         throw new Error('Kids category should not be provided for ADULT plans');
//       }
//       return true;
//     }),
//   body('benefits')
//     .optional()
//     .isArray()
//     .withMessage('Benefits must be an array'),
//   body('is_active')
//     .optional()
//     .isBoolean()
//     .withMessage('is_active must be a boolean value'),
//   body('image')
//     .optional()
//     .isMongoId()
//     .withMessage('Image must be a valid ObjectId'),
//   body('batches')
//     .optional()
//     .isArray()
//     .withMessage('Batches must be an array')
//     .custom((batches) => {
//       if (batches && batches.length > 0) {
//         const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
//         return batches.every(batch => {
//           const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
//           return batch.days && Array.isArray(batch.days) && batch.days.length > 0 &&
//                  batch.days.every(day => validDays.includes(day)) &&
//                  batch.start_time && batch.end_time && 
//                  timeRegex.test(batch.start_time) && timeRegex.test(batch.end_time) &&
//                  batch.start_time < batch.end_time &&
//                  (batch.capacity === undefined || (typeof batch.capacity === 'number' && batch.capacity >= 0));
//         });
//       }
//       return true;
//     })
//     .withMessage('Each batch must have valid days array, start_time, end_time, and optional capacity')
// ];

// const validateUpdateMembershipPlan = [
//   body('name')
//     .optional()
//     .trim()
//     .notEmpty()
//     .withMessage('Name cannot be empty')
//     .isLength({ min: 2, max: 100 })
//     .withMessage('Name must be between 2 and 100 characters'),
//   body('description')
//     .optional()
//     .trim()
//     .isLength({ max: 500 })
//     .withMessage('Description must not exceed 500 characters'),
//   body('prices')
//     .optional()
//     .isObject()
//     .withMessage('Prices must be an object'),
//   body('prices.monthly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Monthly price must be a non-negative number'),
//   body('prices.quarterly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Quarterly price must be a non-negative number'),
//   body('prices.half_yearly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Half yearly price must be a non-negative number'),
//   body('prices.yearly')
//     .optional()
//     .isFloat({ min: 0 })
//     .withMessage('Yearly price must be a non-negative number'),
//   body('dance_type')
//     .optional()
//     .isMongoId()
//     .withMessage('Valid dance_type is required'),
//   body('plan_for')
//     .optional()
//     .isIn(['KID', 'KIDS', 'ADULT'])
//     .withMessage('Invalid plan_for'),
//   body('kids_category')
//     .optional()
//     .isIn(['JUNIOR', 'ADVANCED'])
//     .withMessage('Kids category must be JUNIOR or ADVANCED')
//     .custom((value, { req }) => {
//       if ((req.body.plan_for === 'KID' || req.body.plan_for === 'KIDS') && !value) {
//         throw new Error('Kids category is required for KID/KIDS plans');
//       }
//       if (req.body.plan_for === 'ADULT' && value) {
//         throw new Error('Kids category should not be provided for ADULT plans');
//       }
//       return true;
//     }),
//   body('benefits')
//     .optional()
//     .isArray()
//     .withMessage('Benefits must be an array'),
//   body('is_active')
//     .optional()
//     .isBoolean()
//     .withMessage('is_active must be a boolean value'),
//   body('image')
//     .optional()
//     .isMongoId()
//     .withMessage('Image must be a valid ObjectId'),
//   body('batches')
//     .optional()
//     .isArray()
//     .withMessage('Batches must be an array')
//     .custom((batches) => {
//       if (batches && batches.length > 0) {
//         const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
//         return batches.every(batch => {
//           const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
//           return batch.days && Array.isArray(batch.days) && batch.days.length > 0 &&
//                  batch.days.every(day => validDays.includes(day)) &&
//                  batch.start_time && batch.end_time && 
//                  timeRegex.test(batch.start_time) && timeRegex.test(batch.end_time) &&
//                  batch.start_time < batch.end_time &&
//                  (batch.capacity === undefined || (typeof batch.capacity === 'number' && batch.capacity >= 0));
//         });
//       }
//       return true;
//     })
//     .withMessage('Each batch must have valid days array, start_time, end_time, and optional capacity')
// ];

// const validateId = [
//   param('id')
//     .isMongoId()
//     .withMessage('Invalid membership plan ID')
// ];

// const validatePagination = [
//   query('page')
//     .optional()
//     .isInt({ min: 1 })
//     .withMessage('Page must be a positive integer'),
//   query('limit')
//     .optional()
//     .isInt({ min: 1, max: 100 })
//     .withMessage('Limit must be between 1 and 100'),
//   query('sortBy')
//     .optional()
//     .isIn(['createdAt', 'updatedAt', 'name', 'price'])
//     .withMessage('Invalid sortBy field'),
//   query('sortOrder')
//     .optional()
//     .isIn(['asc', 'desc'])
//     .withMessage('Sort order must be asc or desc'),
//   query('is_active')
//     .optional()
//     .isBoolean()
//     .withMessage('is_active filter must be a boolean value'),
//   query('plan_for')
//     .optional()
//     .isIn(['KID', 'KIDS', 'ADULT'])
//     .withMessage('Invalid plan_for filter'),
//   query('kids_category')
//     .optional()
//     .isIn(['JUNIOR', 'ADVANCED'])
//     .withMessage('Invalid kids_category filter'),
//   query('classTypeId')
//     .optional()
//     .isMongoId()
//     .withMessage('Invalid classTypeId filter'),
//   query('q')
//     .optional()
//     .trim()
//     .isLength({ max: 100 })
//     .withMessage('Search term must not exceed 100 characters')
// ];

// // Routes with validation
// router.post('/', validateMembershipPlan, plansController.createPlan);
// router.get('/', validatePagination, plansController.getPlans);
// router.post('/booking', plansController.createBooking);
// router.get('/check-status', plansController.checkMembershipStatus);
// router.get('/bookings', plansController.getMembershipBookings);
// router.post('/:membershipBookingId/renew', plansController.renewMembership);
// router.get('/user/:userId', plansController.getUserMemberships);
// router.get('/:id', validateId, plansController.getPlanById);
// router.put('/:id', validateId, validateUpdateMembershipPlan, plansController.updatePlan);
// router.delete('/:id', validateId, plansController.deletePlan);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const plansController = require('../../controlers/MembershipPlans');
const membershipBookingController = require('../../controlers/MembershipPlans');

// Validation for batches with schedule array
const validateBatches = body('batches')
  .optional()
  .isArray().withMessage('Batches must be an array')
  .custom((batches) => {
    if (batches && batches.length > 0) {
      const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

      return batches.every(batch => {
        if (!batch.schedule || !Array.isArray(batch.schedule) || batch.schedule.length === 0) {
          return false;
        }

        const allSchedulesValid = batch.schedule.every(sched => 
          sched.day && validDays.includes(sched.day) &&
          sched.start_time && timeRegex.test(sched.start_time) &&
          sched.end_time && timeRegex.test(sched.end_time) &&
          sched.start_time < sched.end_time
        );

        const capacityValid = batch.capacity === undefined || (typeof batch.capacity === 'number' && batch.capacity >= 0);

        return allSchedulesValid && capacityValid;
      });
    }
    return true;
  })
  .withMessage('Each batch must have a valid schedule array with day, start_time, end_time, and optional capacity');

// Validation middleware for creating membership plan
const validateMembershipPlan = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('prices')
    .isObject()
    .withMessage('Prices must be an object'),
  body('prices.monthly')
    .isFloat({ min: 0 })
    .withMessage('Monthly price must be a non-negative number'),
  body('prices.quarterly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quarterly price must be a non-negative number'),
  body('prices.half_yearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Half yearly price must be a non-negative number'),
  body('prices.yearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Yearly price must be a non-negative number'),
  body('dance_type')
    .isMongoId()
    .withMessage('Valid dance_type is required'),
  body('plan_for')
    .optional()
    .isIn(['KID', 'KIDS', 'ADULT'])
    .withMessage('Invalid plan_for'),
  body('kids_category')
    .optional()
    .isIn(['JUNIOR', 'ADVANCED'])
    .withMessage('Kids category must be JUNIOR or ADVANCED')
    .custom((value, { req }) => {
      if ((req.body.plan_for === 'KID' || req.body.plan_for === 'KIDS') && !value) {
        throw new Error('Kids category is required for KID/KIDS plans');
      }
      if (req.body.plan_for === 'ADULT' && value) {
        throw new Error('Kids category should not be provided for ADULT plans');
      }
      return true;
    }),
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value'),
  body('image')
    .optional()
    .isMongoId()
    .withMessage('Image must be a valid ObjectId'),
  validateBatches
];

// Validation middleware for updating membership plan
const validateUpdateMembershipPlan = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('prices')
    .optional()
    .isObject()
    .withMessage('Prices must be an object'),
  body('prices.monthly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly price must be a non-negative number'),
  body('prices.quarterly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quarterly price must be a non-negative number'),
  body('prices.half_yearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Half yearly price must be a non-negative number'),
  body('prices.yearly')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Yearly price must be a non-negative number'),
  body('dance_type')
    .optional()
    .isMongoId()
    .withMessage('Valid dance_type is required'),
  body('plan_for')
    .optional()
    .isIn(['KID', 'KIDS', 'ADULT'])
    .withMessage('Invalid plan_for'),
  body('kids_category')
    .optional()
    .isIn(['JUNIOR', 'ADVANCED'])
    .withMessage('Kids category must be JUNIOR or ADVANCED')
    .custom((value, { req }) => {
      if ((req.body.plan_for === 'KID' || req.body.plan_for === 'KIDS') && !value) {
        throw new Error('Kids category is required for KID/KIDS plans');
      }
      if (req.body.plan_for === 'ADULT' && value) {
        throw new Error('Kids category should not be provided for ADULT plans');
      }
      return true;
    }),
  body('benefits')
    .optional()
    .isArray()
    .withMessage('Benefits must be an array'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value'),
  body('image')
    .optional()
    .isMongoId()
    .withMessage('Image must be a valid ObjectId'),
  validateBatches
];

// Validation for membership plan ID param
const validateId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid membership plan ID')
];

// Validation for pagination and filtering
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'price'])
    .withMessage('Invalid sortBy field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active filter must be a boolean value'),
  query('plan_for')
    .optional()
    .isIn(['KID', 'KIDS', 'ADULT'])
    .withMessage('Invalid plan_for filter'),
  query('kids_category')
    .optional()
    .isIn(['JUNIOR', 'ADVANCED'])
    .withMessage('Invalid kids_category filter'),
  query('classTypeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid classTypeId filter'),
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must not exceed 100 characters')
];

// Routes
router.post('/', validateMembershipPlan, plansController.createPlan);
router.get('/', validatePagination, plansController.getPlans);
router.post('/booking', plansController.createBooking);
router.get('/check-status', plansController.checkMembershipStatus);
router.get('/bookings', plansController.getMembershipBookings);
router.post('/:membershipBookingId/renew', plansController.renewMembership);
router.get('/user/:userId', plansController.getUserMemberships);
router.get('/:id', validateId, plansController.getPlanById);
router.put('/:id', validateId, validateUpdateMembershipPlan, plansController.updatePlan);
router.delete('/:id', validateId, plansController.deletePlan);
router.get('/bookingsByBatch', membershipBookingController.getBookingsByBatchAndName);

module.exports = router;
