const express = require("express");
const router = express.Router();
const { body,param } = require("express-validator");
const { isAuth, isAdmin, isSelfOrAdmin } = require("../../authentication/is-auth");
const userController = require("../../controllers/User");


// Admin only: create a user (any role). Previously public, which let anyone create an ADMIN account.
router.post(
  "/register-token",
  isAdmin,
  [
    body("first_name").not().isEmpty(),
    body("last_name").not().isEmpty(),
    body("email_id").not().isEmpty(),
    body("password").not().isEmpty(),
    // body("phone_number").not().isEmpty(),
    body("role").not().isEmpty(),
  ],
  userController.registerUserWithoutToken
);

router.post(
  "/login",
  [
    body("email").trim().not().isEmpty(),
    body("password").trim().not().isEmpty(),
  ],
  userController.loginUsingEmail
);

// Admin adds user with only COACH role

router.post(
  "/add-coach",
  [
    body("first_name").not().isEmpty().trim(),
    body("last_name").not().isEmpty().trim(),
    body("email_id").isEmail(),
    body("password").isLength({ min: 6 }),
    body("role").equals("COACH"),
    body("media")
      .isArray().withMessage("media must be an array")
      .custom((mediaArr) =>
        // Validate ObjectId format (using mongoose regex)
        mediaArr.every(id => /^[a-fA-F0-9]{24}$/.test(id))
      ).withMessage("All media items must be valid ObjectIds"),
  ],
  isAdmin,
  userController.addCoach
);


router.get('/coaches', isAdmin, userController.getCoaches);

router.patch(
  "/:id/admin-remarks",
  [
    param("id").not().isEmpty(),
    body("admin_remarks").optional({ nullable: true }).isString().isLength({ max: 5000 }),
  ],
  isAdmin,
  userController.updateAdminRemarks
);

router.get('/:id', isSelfOrAdmin('id'), userController.getUser);
router.get('/:id/dashboard', isSelfOrAdmin('id'), userController.getUserDashboard);

// Edit user (admin only)
router.put(
  "/edit/:id",
  [
    param("id").not().isEmpty(),
    body("first_name").optional(),
    body("last_name").optional(),
    body("email_id").optional(),
    body("password").optional(),
    body("role").optional().custom((value) => {
      if (value && value !== "COACH" && value !== "ADMIN") {
        throw new Error("Role must be COACH or ADMIN");
      }
      return true;
    }),
    body("admin_remarks").optional({ nullable: true }).isString().isLength({ max: 5000 }),
  ],
  isAdmin,
  userController.editUser
);


// Delete user (admin only)
router.delete(
  "/delete/:id",
  [param("id").not().isEmpty()],
  isAdmin,
  userController.deleteUser
);

router.patch(
  "/change/password",
  isAuth,
  [body("password").trim().not().isEmpty()],
  userController.changeUserPassword
);
module.exports = router;
