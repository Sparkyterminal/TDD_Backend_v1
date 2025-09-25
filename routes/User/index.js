const express = require("express");
const router = express.Router();
const { body,param } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const userController = require("../../controlers/User");


router.post(
  "/register-token",
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

// router.get(
//   "/:id?",
//   isAuth,
//   userController.getUsers
// );

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
  isAuth,
  userController.addCoach
);


router.get('/coaches', isAuth, userController.getCoaches);
router.get('/:id', isAuth, userController.getUsers);

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
  ],
  isAuth,
  userController.editUser
);

// Delete user (admin only)
router.delete(
  "/delete/:id",
  [param("id").not().isEmpty()],
  isAuth,
  userController.deleteUser
);


module.exports = router;
