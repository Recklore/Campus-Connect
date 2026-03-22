const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { userModel } = require("../models/user");
const { sendVerificationMail } = require("../config/mail");
const {
  verifyEmailTemplate,
  alreadyRegisteredTemplate,
  notInRecordsTemplate,
  forgotPasswordNotRegisteredTemplate,
  forgotPasswordResetLinkTemplate,
} = require("../tamplates/mailTemplates");
const {
  generateToken,
  storeToken,
  verfiyAndDeleteToken,
} = require("../services/verificationToken");
const universityDb = require("../university_data.json");

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:5173";

const findStudentInUniDb = (enrollmentNumber) =>
  universityDb.students.find(
    (s) => s.enrollmentNumber.toUpperCase() === enrollmentNumber.toUpperCase(),
  ) || null;

const findSeniorInUniDb = (email) =>
  universityDb.seniors.find(
    (s) => s.emailId.toLowerCase() === email.toLowerCase(),
  ) || null;

const login = async (req, res) => {
  try {
    const resMessage = "Invalid credentials";
    const { role, password } = req.body;

    let emailId;

    if (!role) {
      return res.status(400).json({ message: "Bad request", success: false });
    } else if (role === "student") {
      const { enrollmentNumber } = req.body;
      emailId = enrollmentNumber.toLowerCase() + "@curaj.ac.in";
    } else if (role === "senior") {
      emailId = req.body.emailId?.toLowerCase();
    } else {
      return res.status(400).json({ message: "Bad request", success: false });
    }
    const user = await userModel.findOne({ emailId });

    if (!user) {
      const isPassCorrect = await bcrypt.compare(password, "polkadots");
      return res.status(403).json({ message: resMessage, success: false });
    }

    const isPassCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPassCorrect) {
      return res.status(403).json({ message: resMessage, success: false });
    }

    const jwtToken = jwt.sign(
      { emailId: user.emailId, _id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 3600 },
    );

    return res.status(202).json({
      message: "Login successful",
      success: true,
      jwtToken,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const signupInit = async (req, res) => {
  try {
    const resMessage = "Please check your email inbox for further instructions";
    const { role, password } = req.body;

    let emailId;
    let uniRecord;

    if (!role) {
      return res.status(400).json({ message: "Bad request", success: false });
    } else if (role === "student") {
      const { enrollmentNumber } = req.body;
      emailId = enrollmentNumber.toLowerCase() + "@curaj.ac.in";
      uniRecord = findStudentInUniDb(enrollmentNumber);
    } else if (role === "senior") {
      emailId = req.body.emailId?.toLowerCase();
      uniRecord = findSeniorInUniDb(emailId);
    } else {
      return res.status(400).json({ message: "Bad request", success: false });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.findOne({ emailId });
    const verficationToken = generateToken();

    if (user) {
      sendVerificationMail(
        emailId,
        alreadyRegisteredTemplate(emailId, `${FRONTEND_BASE_URL}/auth/login`),
      );
      return res.status(202).json({ message: resMessage, success: true });
    } else if (!uniRecord) {
      sendVerificationMail(emailId, notInRecordsTemplate(emailId));
      return res.status(202).json({ message: resMessage, success: true });
    } else {
      const userPayload = {
        userData: uniRecord,
        passwordHash,
        role,
        createdAt: Date.now(),
      };
      await storeToken(verficationToken.tokenHash, userPayload);
      sendVerificationMail(
        emailId,
        verifyEmailTemplate(
          `${FRONTEND_BASE_URL}/auth/verify/${verficationToken.rawToken}`,
        ),
      );
      return res.status(202).json({ message: resMessage, success: true });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const signupVerify = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;

    if (!token) {
      return res.status(400).json({ message: "Invalid token", success: false });
    }

    const payload = await verfiyAndDeleteToken(token);
    const parsedPayload =
      typeof payload === "string" ? JSON.parse(payload) : payload;

    if (!parsedPayload) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token", success: false });
    }

    const { passwordHash, userData, role } = parsedPayload;

    // Idempotent verify: if account already exists, treat verification as complete.
    const existingUser = await userModel.findOne({ emailId: userData.emailId });
    if (existingUser) {
      return res
        .status(200)
        .json({ message: "User already verified. Please log in.", success: true });
    }

    const createPayload = {
      name: userData.name,
      emailId: userData.emailId,
      passwordHash,
      role,
      department: userData.department,
    };

    if (role === "student") {
      createPayload.dob = new Date(userData.dob);
      createPayload.enrollmentNumber = userData.enrollmentNumber;
    } else if (role === "senior") {
      createPayload.employeeId = userData.employeeId;
      createPayload.designation = userData.designation;
    } else {
      return res
        .status(500)
        .json({ message: "Internal Server Error", success: false });
    }

    try {
      await userModel.create(createPayload);
    } catch (createErr) {
      // Handles race conditions where two verification requests run concurrently.
      if (createErr?.code === 11000) {
        return res
          .status(200)
          .json({ message: "User already verified. Please log in.", success: true });
      }
      throw createErr;
    }

    return res
      .status(201)
      .json({ message: "User registered successfully", success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const forgotPasswordInit = async (req, res) => {
  try {
    const resMessage = "Please check your email inbox for further instructions";
    const { role } = req.body;

    let emailId;

    if (!role) {
      return res.status(400).json({ message: "Bad request", success: false });
    } else if (role === "student") {
      const { enrollmentNumber } = req.body;
      emailId = enrollmentNumber.toLowerCase() + "@curaj.ac.in";
    } else if (role === "senior") {
      emailId = req.body.emailId?.toLowerCase();
    } else {
      return res.status(400).json({ message: "Bad request", success: false });
    }

    const user = await userModel.findOne({ emailId });
    const verficationToken = generateToken();

    if (!user) {
      sendVerificationMail(
        emailId,
        forgotPasswordNotRegisteredTemplate(emailId),
      );
      return res.status(202).json({ message: resMessage, success: true });
    } else {
      const userPayload = {
        userEmailId: user.emailId,
        passwordHash: user.passwordHash,
        createdAt: Date.now(),
      };
      await storeToken(verficationToken.tokenHash, userPayload);
      sendVerificationMail(
        emailId,
        forgotPasswordResetLinkTemplate(
          `${FRONTEND_BASE_URL}/auth/forgotPass/verify/${verficationToken.rawToken}`,
        ),
      );
      return res.status(202).json({ message: resMessage, success: true });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const forgotPasswordVerify = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;
    const newPassword = req.body.password;

    const newPasswordHash = await bcrypt.hash(newPassword, 10);


    if (!token) {
      return res.status(400).json({ message: "Invalid token", success: false });
    }

    const payload = await verfiyAndDeleteToken(token);
    const parsedPayload =
      typeof payload === "string" ? JSON.parse(payload) : payload;

    if (!parsedPayload) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token", success: false });
    }
    else if (parsedPayload.passwordHash === newPasswordHash)
    {
      return res
        .status(400)
        .json({ message: "Cannot use the old password again", success: false });
    }

    const { userEmailId } = parsedPayload;

    await userModel.updateOne(
      { emailId: userEmailId },
      { $set: { passwordHash: newPasswordHash } },
      { new: true },
    );

    return res
      .status(201)
      .json({ message: "Password changed successfully", success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

module.exports = {
  login,
  signupInit,
  signupVerify,
  forgotPasswordInit,
  forgotPasswordVerify,
};
