require("dotenv").config(); 
const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");
const User = require("../../modals/Users");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');


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


    // console.log(user)


    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      let loadedUser = user;

      // if(loadedUser.role === "USER"){
      //   return res.status(STATUS.BAD_REQUEST).json({
      //     message: "Login using KGID",
      //   });
      // }

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

module.exports.getUser = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Invalid user ID" });
    }

    const userAgg = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "media",
          localField: "media",
          foreignField: "_id",
          as: "media"
        }
      },
      {
        $project: {
          first_name: 1,
          last_name: 1,
          email_data: 1,
          phone_data: 1,
          role: 1,
          is_active: 1,
          is_archived: 1,
          media: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);

    if (!userAgg || userAgg.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ data: userAgg[0] });
  } catch (error) {
    console.error('Aggregation error:', error);
    return res.status(500).json({ message: "Internal server error", error });
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
  const token = req.get("Authorization");
  let decodedToken = token ? jwt.decode(token) : null;

  if (!decodedToken || decodedToken.role !== "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
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
// module.exports.getCoaches = async (req, res) => {
//   const errors = validationResult(req);
//   console.log(errors)
//   if (!errors.isEmpty()) {
//     return res.status(STATUS.BAD_REQUEST).json({
//       message: "Bad request",
//       fields: errors.array(),
//     });
//   }
//   const token = req.get("Authorization");
//   let decodedToken = token ? jwt.decode(token) : null;

//   if (!decodedToken || decodedToken.role !== "ADMIN") {
//     return res.status(STATUS.UNAUTHORISED).json({
//       message: MESSAGE.unauthorized,
//     });
//   }
//   try {
//     // Build search query if needed (optional)
//     const searchTerm = req.query.q ? req.query.q.trim() : "";

//     // Match criteria for coaches, with optional search filtering
//     let matchCriteria = { role: "COACH" };

//     if (searchTerm.length > 0) {
//       const regex = new RegExp(searchTerm, "i"); // Case-insensitive regex
//       matchCriteria.$or = [
//         { first_name: regex },
//         { last_name: regex },
//         { "email_data.temp_email_id": regex },
//       ];
//     }

//     // Fetch coaches with media populated
//     const coaches = await User.find(matchCriteria)
//       .populate("media")
//       .select(
//         "first_name last_name email_data phone_data role is_active is_archived media createdAt updatedAt"
//       )
//       .exec();

//     return res.status(200).json({
//       message: "Coaches fetched successfully",
//       data: coaches,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: "Server error while fetching coaches",
//       error: error.message || error,
//     });
//   }
// };

module.exports.getCoaches = async (req, res) => {
  try {
    const coaches = await User.aggregate([
      { $match: { role: "COACH" } },
      {
        $lookup: {
          from: "media",              // collection name in MongoDB
          localField: "media",        // field in users schema
          foreignField: "_id",        // field in media collection
          as: "media_details",       // output array field
        }
      },
      {
        $project: {
          first_name: 1,
          last_name: 1,
          email_data: 1,
          phone_data: 1,
          role: 1,
          is_active: 1,
          is_archived: 1,
          media_details: 1,          // include media details as nested array
          createdAt: 1,
          updatedAt: 1,
        }
      }
    ]);

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
    return res.status(STATUS.BAD_REQUEST).json({ message: 'Bad request', fields: errors.array() });
  }

  const token = req.get('Authorization');
  let decodedToken = token ? jwt.decode(token) : null;

  if (!decodedToken || decodedToken.role !== 'ADMIN') {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  }

  const userId = req.params.id;
  const updates = {};

  if (req.body.first_name) updates.first_name = req.body.first_name.toLowerCase().replace(/\s/g, '');
  if (req.body.last_name) updates.last_name = req.body.last_name.toLowerCase().replace(/\s/g, '');
  if (req.body.email_id) updates['email_data.temp_email_id'] = req.body.email_id.toLowerCase();

  if (req.body.password) {
    updates.password = await bcrypt.hash(req.body.password, 12);
  }
  if (req.body.role) updates.role = req.body.role;

  if (req.body.media) {
    if (!Array.isArray(req.body.media)) {
      return res.status(STATUS.BAD_REQUEST).json({ message: 'media must be an array of IDs' });
    }
    try {
      updates.media = req.body.media.map((id) => new mongoose.Types.ObjectId(id));
    } catch (err) {
      return res.status(STATUS.BAD_REQUEST).json({ message: 'Invalid media ID format' });
    }
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!updatedUser) return res.status(STATUS.NOT_FOUND).json({ message: 'User not found' });
    return res.status(STATUS.SUCCESS).json({ message: 'User updated', data: updatedUser });
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
  const token = req.get("Authorization");
  let decodedToken = token ? jwt.decode(token) : null;

  if (!decodedToken || decodedToken.role !== "ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
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