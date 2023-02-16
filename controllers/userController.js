const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const nodemailer = require("nodemailer");

// Register user
exports.registerUser = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  // Check if mobile or email is already registered
  let user = await User.findOne({
    $or: [{ mobile: req.body.mobile }, { email: req.body.email }],
  });
  if (user) {
    return res.status(400).json({ msg: "User already exists" });
  }

  // Create new user
  user = new User({
    name: req.body.name,
    mobile: req.body.mobile,
    email: req.body.email,
    password: req.body.password,
    referralCode: req.body.referralCode,
  });

  // Hash password and save user
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  await user.save();

  res.status(201).json({ msg: "User registered successfully" });
};

// Send OTP to mobile number
exports.sendOtp = async (req, res) => {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Save OTP and expiration time in user document
  const user = await User.findOne({ mobile: req.body.mobile });
  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }

  user.otp = otp;
  user.otpExpiration = expirationTime;
  await user.save();

  // Send OTP via Twilio
  twilio.messages
    .create({
      body: `Your OTP for mobile verification is ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.mobile,
    })
    .then((message) => res.json({ msg: "OTP sent successfully" }))
    .catch((err) => res.status(500).json({ error: err.message }));
};

// Verify OTP and set user as verified
exports.verifyOtp = async (req, res) => {
  const user = await User.findOne({ mobile: req.body.mobile });
  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }

  if (user.otp !== req.body.otp) {
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  if (user.otpExpiration < Date.now()) {
    return res.status(400).json({ msg: "OTP expired" });
  }

  user.isVerified = true;
  user.otp = null;
  user.otpExpiration = null;
  await user.save();

  // Generate JWT and set it as a cookie
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600000, // 1 hour
  });

  res.json({ msg: "OTP verified successfully" });
};

// Set user PIN
exports.setPin = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }

  if (user.pin) {
    return res.status(400).json({ msg: "PIN already set" });
  }

  user.pin = req.body.pin;
  await user.save();

  res.json({ msg: "PIN set successfully" });
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Save OTP and expiration time in user document
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }

  user.otp = otp;
  user.otpExpiration = expirationTime;
  await user.save();

  // Send OTP via email
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL,
    to: user.email,
    subject: "Reset Password OTP",
    text: `Your OTP for resetting your password is ${otp}`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({ msg: "OTP sent successfully" });
  });
};

// Reset password
exports.resetPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(400).json({ msg: "User not found" });
  }

  if (user.otp !== req.body.otp) {
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  if (user.otpExpiration < Date.now()) {
    return res.status(400).json({ msg: "OTP expired" });
  }

  // Hash new password and save user
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(req.body.password, salt);
  user.otp = null;
  user.otpExpiration = null;
  await user.save();

  res.json({ msg: "Password reset successfully" });
};

// Define login controller function
exports.login = async (req, res) => {
  const { mobile, password } = req.body;

  // Check if user with given mobile number exists
  const user = await User.findOne({ mobile });

  if (!user) {
    return res
      .status(401)
      .json({ message: "Authentication failed. User not found." });
  }
  // Check if password is correct
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res
      .status(401)
      .json({ message: "Authentication failed. Wrong password." });
  }
  // Sign JWT token and send response
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.status(200).json("Logged in");
};
