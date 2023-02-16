const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const userController = require("../controllers/userController");

router.post(
  "/register",
  [
    check("name", "Name is required").not().isEmpty(),
    check("mobile", "Mobile number is required").not().isEmpty(),
    check("mobile", "Invalid mobile number").isMobilePhone(),
    check("email", "Invalid email").isEmail(),
    check("password", "Password must be at least 6 characters long").isLength({
      min: 6,
    }),
  ],
  userController.registerUser
);

router.post(
  "/send-otp",
  [check("mobile", "Mobile number is required").not().isEmpty()],
  userController.sendOtp
);

router.post(
  "/verify-otp",
  [
    check("mobile", "Mobile number is required").not().isEmpty(),
    check("otp", "OTP is required").not().isEmpty(),
  ],
  userController.verifyOtp
);

router.post(
  "/set-pin",
  [
    check("pin", "PIN is required").not().isEmpty(),
    check("pin", "PIN must be a 4-digit number").isNumeric().isLength({
      min: 4,
      max: 4,
    }),
  ],
  userController.setPin
);

router.post(
  "/forgot-password",
  [check("email", "Invalid email").isEmail()],
  userController.forgotPassword
);

router.post(
  "/reset-password",
  [
    check("otp", "OTP is required").not().isEmpty(),
    check("password", "Password must be at least 6 characters long").isLength({
      min: 6,
    }),
  ],
  userController.resetPassword
);

router.post(
  "/login",
  body("mobileNumber")
    .notEmpty()
    .isMobilePhone("any")
    .withMessage("Mobile number is not valid."),
  body("password").notEmpty().withMessage("Password cannot be empty."),
  userController.login
);

module.exports = router;
