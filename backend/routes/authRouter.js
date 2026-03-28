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

authRouter.post("/login", loginRules, login);
authRouter.post("/guestLogin", guestLogin);

authRouter.post("/signup", signupInitRules, signupInit);
authRouter.post("/verify/resend", signupInitRules, signupResend);
authRouter.post("/verify/:token", signupVerifyRules, signupVerify);
authRouter.post("/verify", signupVerifyRules, signupVerify);

authRouter.post(
  "/forgotPass/init",
  forgotPasswordInitRules,
  forgotPasswordInit,
);
authRouter.post(
  "/forgotPass/verify/:token",
  forgotPasswordVerifyRules,
  forgotPasswordVerify,
);
authRouter.post(
  "/forgotPass/verify",
  forgotPasswordVerifyRules,
  forgotPasswordVerify,
);

module.exports = { authRouter };
