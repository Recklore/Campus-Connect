const authRouter = require("express").Router();
const {
  login,
  guestLogin,
  signupInit,
  signupResend,
  signupVerify,
  forgotPasswordInit,
  forgotPasswordVerify,
} = require("../controller/authController");
const {
  loginRules,
  signupInitRules,
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
  signupInitRules,
  signupResend,
);
authRouter.post(
  "/verify/:token",
  guestLimiter,
  signupVerifyRules,
  signupVerify,
);
authRouter.post("/verify", guestLimiter, signupVerifyRules, signupVerify);

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
authRouter.post(
  "/forgotPass/verify",
  guestLimiter,
  forgotPasswordVerifyRules,
  forgotPasswordVerify,
);

module.exports = { authRouter };
