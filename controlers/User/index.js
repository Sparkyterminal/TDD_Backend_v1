require("dotenv").config(); 
const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const User = require("../../modals/Users");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");


const jwt = require("jsonwebtoken");

const validations = require("../../utils/validations");
// const mongoose = require('mongoose');

const JWT_SECRET = process.env.DANCE_DISTRICT_JWT_SECRET;
const TOKEN_VALIDITY = process.env.DANCE_DISTRICT_TOKEN_VALIDITY;
const TOKEN_MAX_VALIDITY = process.env.DANCE_DISTRICT_TOKEN_MAX_VALIDITY;


module.exports.registerUserWithoutToken = async (req, res) => {
  console.log('HEADERS:', req.headers);
  console.log('BODY:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const { first_name, last_name, email_id, password, role } = req.body;

  const isFirstNameValid = await validations.validateName(first_name);
  const isLastNameValid = await validations.validateName(last_name);
  const isPasswordValid = await validations.validatePassword(password);
  console.log(isFirstNameValid,isLastNameValid,isPasswordValid)

  if (
    isFirstNameValid.status === false ||
    isLastNameValid.status === false ||
    email_id === "" ||
    isPasswordValid.status === false   ) {
    const inputs_errors = [];

    if (isFirstNameValid.status === false) {
      inputs_errors.push("FIRST_NAME");
    }

    if (isLastNameValid.status === false) {
      inputs_errors.push("LAST_NAME");
    }

    if (email_id === "") {
      inputs_errors.push("EMAIL_ID");
    }

    if (isPasswordValid.status === false) {
      inputs_errors.push("PASSWORD");
    }

    

    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Invalid Inputs",
      fields: inputs_errors,
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  let user = new User({
    first_name: first_name.toLowerCase().replaceAll(/\s/g, ""),
    last_name: last_name.toLowerCase().replaceAll(/\s/g, ""),
   
    email_data: {
      temp_email_id: email_id.toLowerCase(),
      is_validated: true,
    },
    password: hashedPassword,
    
    role: role,
  });

  try {
    const savedUser = await user.save();

    return res.status(STATUS.CREATED).json({
      message: "User Created Successfully",
      data: savedUser.id,
    });
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
      error,
    });
  }
};

module.exports.loginUsingEmail = async (req,res) => {
  const errors = validationResult(req);
  console.log(errors)
  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const email = req.body.email.toLowerCase();
  const password = req.body.password;

  try {
    let user = await User.findOne({ "email_data.temp_email_id": email });



    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      let loadedUser = user;

      if(loadedUser.role === "TNO"){
        return res.status(STATUS.BAD_REQUEST).json({
          message: "Login using KGID",
        });
      }

      let isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        res.status(STATUS.UNAUTHORISED).json({
          message: "Invalid password",
        });
      } else {
        const accessToken = jwt.sign(
          {
            uid: loadedUser.id,
            role: loadedUser.role,
          },
          JWT_SECRET,
          { expiresIn: TOKEN_VALIDITY }
        );

        const refreshToken = jwt.sign(
          {
            uid: loadedUser.id,
            role: loadedUser.role,
          },
          JWT_SECRET,
          { expiresIn: TOKEN_MAX_VALIDITY }
        );

        const response_data = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user_id: loadedUser.id,
          name: `${loadedUser.first_name} ${loadedUser.last_name}`,
          email: loadedUser.email_data.temp_email_id,
          role: loadedUser.role,
          is_dis: loadedUser.is_dis,
        };

        return res.status(STATUS.SUCCESS).json({
          message: "Login Successfull",
          data: response_data,
        });
      }
    }
  } catch (error) {
    //console.log(error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.getUsers = async (req, res) => {
  try {
    const id = req.params.id;
    if (id) {
      const user = await User.findById(id);
      if (!user) return res.status(STATUS.NOT_FOUND).json({ message: "User not found" });
      return res.status(STATUS.SUCCESS).json({ data: user });
    } else {
      const users = await User.find();
      return res.status(STATUS.SUCCESS).json({ data: users });
    }
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGE.internalServerError, error });
  }
};

// Add COACH (by admin only)
module.exports.addCoach = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: "Bad request",
      fields: errors.array(),
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: "Only ADMIN can add coach",
    });
  }

  const { first_name, last_name, email_id, password, role, media } = req.body;

  if (role !== "COACH") {
    return res.status(STATUS.BAD_REQUEST).json({
      message: "Only COACH role can be added",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      first_name: first_name.toLowerCase().replace(/\s/g, ""),
      last_name: last_name.toLowerCase().replace(/\s/g, ""),
      email_data: {
        temp_email_id: email_id.toLowerCase(),
        is_validated: true,
      },
      password: hashedPassword,
      role: "COACH",
      media: media,
    });

    const savedUser = await user.save();
    return res.status(STATUS.CREATED).json({
      message: "Coach Created Successfully",
      data: savedUser.id,
    });
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
      error,
    });
  }
};



// Controller: Get all coaches
module.exports.getCoaches = async (req, res) => {
  try {
    const coaches = await User.find({ role: "COACH" });
    return res.status(200).json({
      message: "Coaches fetched successfully",
      data: coaches,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while fetching coaches",
      error,
    });
  }
};

// Edit user (by admin only)
module.exports.editUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({ message: "Bad request", fields: errors.array() });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({ message: "Only ADMIN can edit users" });
  }

  const userId = req.params.id;
  const updates = {};
  if (req.body.first_name) updates.first_name = req.body.first_name.toLowerCase().replaceAll(/\s/g, "");
  if (req.body.last_name) updates.last_name = req.body.last_name.toLowerCase().replaceAll(/\s/g, "");
  if (req.body.email_id) updates["email_data.temp_email_id"] = req.body.email_id.toLowerCase();
  if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 12);
  if (req.body.role) updates.role = req.body.role;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!updatedUser) return res.status(STATUS.NOT_FOUND).json({ message: "User not found" });
    return res.status(STATUS.SUCCESS).json({ message: "User updated", data: updatedUser });
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGE.internalServerError, error });
  }
};

// Delete user (by admin only)
module.exports.deleteUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({ message: "Bad request", fields: errors.array() });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({ message: "Only ADMIN can delete users" });
  }

  const userId = req.params.id;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(STATUS.NOT_FOUND).json({ message: "User not found" });
    return res.status(STATUS.SUCCESS).json({ message: "User deleted", data: userId });
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({ message: MESSAGE.internalServerError, error });
  }
};