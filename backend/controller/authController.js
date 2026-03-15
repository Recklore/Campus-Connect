const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userModel } = require("../models/user");

const login = async (req, res) => {
  try {
    const { emailId, enrollmentId, password } = req.body;
    const userId = emailId || enrollmentId;

    const errMsg = "Authentication failed, invalid credentials";

    const user = await userModel.findOne({ userId });

    if (!user) {
      return (res.status(403).json({ message: errMsg, success: false }));
    }

    const isPassCorrect = await bcrypt.compare(password, user.password);

    if (!isPassCorrect) {
      return (res.status(403).json({ message: errMsg, success: false }));
    }

    const jwtToken = jwt.sign(
      { email: user.emailId, _id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 3600 },
    );

    res
      .status(202)
      .json({ message: "Login successful", success: true, jwtToken, emailId });
  } catch {
    res.status(500).json({ message: "Internal Server Error", success: true });
  }
};

const signup = async (req, res) => {
  try {
    const { firstName, gender, dob, emailId, enrollmentId, password } = req.body;
 
    const user = await userModel.findOne({ emailId });

    if (user) {
      return (
        res.status(409),
        json({ message: "user already exists", success: false })
      );
    }

    const { lastName } = req.body.lastName || null;

    const newUser = new userModel({
      firstName,
      lastName,
      gender,
      dob,
      emailId,
      enrollmentId,
      password,
    });
    newUser.password = await bcrypt.hash(password, 10);
    await newUser.save();

    res.status(201).json({ message: "Sign-up successful", success: true });
  } catch {
    res.status(500).json({ message: "Internal Server Error", success: true });
  }
};

module.exports = { signup, login };
