const authRouter = require("express").Router();
const { signup, login, verify } = require("../controller/authController");
const {
  loginRules,
  signupRules,
  verifyRules,
} = require("../middleware/authValidation");

authRouter.post("/login", loginRules, login);

authRouter.post("/signup", signupRules, signup);

authRouter.post("/verify/:token", verifyRules, verify);
authRouter.post("/verify", verifyRules, verify);
authRouter.get("/verify/:token", verifyRules, verify);
authRouter.get("/verify", verifyRules, verify);

module.exports = { authRouter };
