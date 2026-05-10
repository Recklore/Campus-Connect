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

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:5173";
const SIGNUP_RESEND_COOLDOWN_SECONDS = 30;
const SIGNUP_RESEND_COOLDOWN_PREFIX = "signup:resend:cooldown:";
const AUTH_COOKIE_NAME = "campus_connect_token";
const REFRESH_COOKIE_NAME = "campus_connect_refresh";

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
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
};

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...getCookieBaseOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getCookieBaseOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieBaseOptions());
};

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

    if (!isPassCorrect || !user.isActive) {
      return res.status(401).json({ message: resMessage, success: false });
    }

    // Generate access token (15 minutes)
    const accessToken = jwt.sign(
      { emailId: user.emailId, _id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 900 }, // 15 minutes
    );

    // Generate refresh token (7 days)
    const refreshToken = jwt.sign(
      { emailId: user.emailId, _id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 604800 }, // 7 days
    );

    // Hash and store refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await userModel.findByIdAndUpdate(user._id, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      lastLoginAt: new Date(),
    });

    setAuthCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

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
  try {
    if (req.user && req.user._id) {
      await userModel.findByIdAndUpdate(req.user._id, {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      });
    }
    
    clearAuthCookie(res);
    clearRefreshCookie(res);
    
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    clearAuthCookie(res);
    clearRefreshCookie(res);
    
    return res.status(200).json({ success: true, message: "Logged out" });
  }
};

const signupInit = async (req, res) => {
  try {
    const resMessage = "Please check your email inbox for further instructions";
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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.findOne({ emailId });
    const verficationToken = generateToken();

    if (!user) {
      sendVerificationMail(emailId, notInRecordsTemplate(emailId));
      return res.status(202).json({ message: resMessage, success: true });
    }

    if (user.isActive) {
      sendVerificationMail(
        emailId,
        alreadyRegisteredTemplate(emailId, `${FRONTEND_BASE_URL}/auth/login`),
      );
      return res.status(202).json({ message: resMessage, success: true });
    } else {
      const userPayload = {
        userEmailId: user.emailId,
        passwordHash,
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

    const cooldownKey = SIGNUP_RESEND_COOLDOWN_PREFIX + emailId;
    const isCooldownActive = await redisClient.get(cooldownKey);

    if (isCooldownActive) {
      return res.status(202).json({ message: resMessage, success: true });
    }

    const user = await userModel.findOne({ emailId });

    if (!user) {
      sendVerificationMail(emailId, notInRecordsTemplate(emailId));
      await redisClient.set(cooldownKey, "1", {
        EX: SIGNUP_RESEND_COOLDOWN_SECONDS,
      });
      return res.status(202).json({ message: resMessage, success: true });
    }

    if (user.isActive) {
      sendVerificationMail(
        emailId,
        alreadyRegisteredTemplate(emailId, `${FRONTEND_BASE_URL}/auth/login`),
      );
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

    const { passwordHash, userEmailId, userData } = parsedPayload;
    const emailId = userEmailId || userData?.emailId;

    if (!emailId || !passwordHash) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token", success: false });
    }

    const existingUser = await userModel.findOne({ emailId });

    if (!existingUser) {
      return res
        .status(400)
        .json({ message: "Invalid or expired token", success: false });
    }

    if (existingUser.isActive) {
      return res
        .status(200)
        .json({
          message: "User already verified. Please log in.",
          success: true,
        });
    }

    await userModel.updateOne(
      { emailId },
      {
        $set: {
          passwordHash,
          isActive: true,
        },
      },
      { new: true },
    );

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

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Refresh token not found", success: false });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET_KEY);
    } catch (err) {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid or expired refresh token", success: false });
    }

    const user = await userModel.findById(decoded._id);

    if (!user || !user.refreshTokenHash) {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "User not found or session expired", success: false });
    }

    // Verify stored refresh token hash
    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isRefreshTokenValid) {
      // Potential token theft - clear all sessions
      await userModel.findByIdAndUpdate(user._id, {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      });
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid refresh token", success: false });
    }

    // Check if refresh token is expired
    if (new Date() > user.refreshTokenExpiresAt) {
      clearAuthCookie(res);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Refresh token expired", success: false });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { emailId: user.emailId, _id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: 900 }, // 15 minutes
    );

    // Optionally generate new refresh token if expiring soon (less than 1 day left)
    let newRefreshToken = null;
    const daysLeft = (user.refreshTokenExpiresAt - new Date()) / (24 * 60 * 60 * 1000);
    
    if (daysLeft < 1) {
      newRefreshToken = jwt.sign(
        { emailId: user.emailId, _id: user._id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: 604800 }, // 7 days
      );
      const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
      const newRefreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await userModel.findByIdAndUpdate(user._id, {
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
      });

      setRefreshCookie(res, newRefreshToken);
    }

    setAuthCookie(res, newAccessToken);

    return res.status(200).json({
      message: "Token refreshed successfully",
      success: true,
    });
  } catch (err) {
    clearAuthCookie(res);
    clearRefreshCookie(res);
    return res
      .status(500)
      .json({ message: `Internal Server Error ${err}`, success: false });
  }
};

module.exports = {
  login,
  guestLogin,
  logout,
  refreshAccessToken,
  signupInit,
  signupResend,
  signupVerify,
  forgotPasswordInit,
  forgotPasswordVerify,
};
