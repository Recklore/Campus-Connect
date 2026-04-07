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
  storeSignupPendingToken,
  getSignupPendingByEmail,
  refreshSignupPendingTtl,
  verfiyAndDeleteToken,
} = require("../services/verificationToken");
const { redisClient } = require("../config/redis");
const universityDb = require("../university_data.json");

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:5173";
const SIGNUP_RESEND_COOLDOWN_SECONDS = 30;
const SIGNUP_RESEND_COOLDOWN_PREFIX = "signup:resend:cooldown:";
const AUTH_COOKIE_NAME = "campus_connect_token";

const getCookieBaseOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
};

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...getCookieBaseOptions(),
    maxAge: 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getCookieBaseOptions());
};

const findStudentInUniDb = (enrollmentNumber) =>
  universityDb.students.find(
    (s) => s.enrollmentNumber.toUpperCase() === enrollmentNumber.toUpperCase(),
  ) || null;

const findSeniorInUniDb = (email) =>
  universityDb.seniors.find(
    (s) => s.emailId.toLowerCase() === email.toLowerCase(),
  ) || null;

const guestLogin = (req, res) => {
  const jwtToken = jwt.sign(
    { role: "guest", roleLevel: 0 },
    process.env.JWT_SECRET_KEY,
    { expiresIn: 3600 },
  );
  setAuthCookie(res, jwtToken);
  return res.status(200).json({ message: "Logged in as guest", success: true });
};

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
      await bcrypt.compare(password, "polkadots");
      return res.status(401).json({ message: resMessage, success: false });
    }

    const isPassCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPassCorrect) {
      return res.status(401).json({ message: resMessage, success: false });
    }

    const jwtToken = jwt.sign(
      { emailId: user.emailId, _id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 3600 },
    );

    setAuthCookie(res, jwtToken);

    return res.status(200).json({
      message: "Login successful",
      success: true,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const logout = async (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: "Logged out" });
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
      await storeSignupPendingToken({
        emailId,
        tokenHash: verficationToken.tokenHash,
        rawToken: verficationToken.rawToken,
        payload: userPayload,
      });
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

const signupResend = async (req, res) => {
  try {
    const resMessage = "Please check your email inbox for further instructions";
    const { role } = req.body;

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

    const cooldownKey = SIGNUP_RESEND_COOLDOWN_PREFIX + emailId;
    const isCooldownActive = await redisClient.get(cooldownKey);

    if (isCooldownActive) {
      return res.status(202).json({ message: resMessage, success: true });
    }

    const user = await userModel.findOne({ emailId });

    if (user) {
      sendVerificationMail(
        emailId,
        alreadyRegisteredTemplate(emailId, `${FRONTEND_BASE_URL}/auth/login`),
      );
      await redisClient.set(cooldownKey, "1", {
        EX: SIGNUP_RESEND_COOLDOWN_SECONDS,
      });
      return res.status(202).json({ message: resMessage, success: true });
    }

    if (!uniRecord) {
      sendVerificationMail(emailId, notInRecordsTemplate(emailId));
      await redisClient.set(cooldownKey, "1", {
        EX: SIGNUP_RESEND_COOLDOWN_SECONDS,
      });
      return res.status(202).json({ message: resMessage, success: true });
    }

    const pendingSignup = await getSignupPendingByEmail(emailId);

    if (pendingSignup?.payload?.rawToken) {
      await refreshSignupPendingTtl(emailId, pendingSignup.tokenHash);
      sendVerificationMail(
        emailId,
        verifyEmailTemplate(
          `${FRONTEND_BASE_URL}/auth/verify/${pendingSignup.payload.rawToken}`,
        ),
      );
    }

    await redisClient.set(cooldownKey, "1", {
      EX: SIGNUP_RESEND_COOLDOWN_SECONDS,
    });

    return res.status(202).json({ message: resMessage, success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

const signupVerify = async (req, res) => {
  try {
    const token = req.params.token;

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

    const existingUser = await userModel.findOne({ emailId: userData.emailId });
    if (existingUser) {
      return res
        .status(200)
        .json({
          message: "User already verified. Please log in.",
          success: true,
        });
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
      if (createErr?.code === 11000) {
        return res
          .status(200)
          .json({
            message: "User already verified. Please log in.",
            success: true,
          });
      }
      throw createErr;
    }

    return res
      .status(200)
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
    const token = req.params.token;
    const newPassword = req.body.password;

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

    const isPasswordReused = await bcrypt.compare(
      newPassword,
      parsedPayload.passwordHash,
    );

    if (isPasswordReused) {
      return res
        .status(400)
        .json({ message: "Cannot use the old password again", success: false });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const { userEmailId } = parsedPayload;

    await userModel.updateOne(
      { emailId: userEmailId },
      { $set: { passwordHash: newPasswordHash } },
      { new: true },
    );

    return res
      .status(200)
      .json({ message: "Password changed successfully", success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

module.exports = {
  login,
  guestLogin,
  logout,
  signupInit,
  signupResend,
  signupVerify,
  forgotPasswordInit,
  forgotPasswordVerify,
};
