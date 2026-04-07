const authRouter = require("express").Router();
const {
  login,
  guestLogin,
  logout,
  signupInit,
  signupResend,
  signupVerify,
  forgotPasswordInit,
  forgotPasswordVerify,
} = require("../controller/authController");
const {
  loginRules,
  signupInitRules,
  signupResendRules,
  signupVerifyRules,
  forgotPasswordInitRules,
  forgotPasswordVerifyRules,
} = require("../middleware/authValidation");
const {
  loginLimiter,
  signupLimiter,
  guestLimiter,
  ipCeilingLimiter,
} = require("../middleware/rateLimiters");

authRouter.post("/login", loginLimiter, loginRules, login);
authRouter.post("/guestLogin", guestLimiter, guestLogin);
authRouter.post("/logout", guestLimiter, logout);

authRouter.post(
  "/signup",
  ipCeilingLimiter,
  signupLimiter,
  signupInitRules,
  signupInit,
);
authRouter.post(
  "/verify/resend",
  ipCeilingLimiter,
  signupLimiter,
  signupResendRules,
  signupResend,
);
authRouter.post(
  "/verify/:token",
  guestLimiter,
  signupVerifyRules,
  signupVerify,
);

authRouter.post(
  "/forgotPass/init",
  loginLimiter,
  forgotPasswordInitRules,
  forgotPasswordInit,
);
authRouter.post(
  "/forgotPass/verify/:token",
  guestLimiter,
  forgotPasswordVerifyRules,
  forgotPasswordVerify,
);

module.exports = { authRouter };
