const authRouter = require("express").Router();
const { signup, login } = require("../controller/authController");
const {
  loginValidation,
  signupValidation,
} = require("../middleware/authValidation");

authRouter.post("/login", loginValidation, login);

authRouter.post("/signup", signupValidation, signup);

module.exports = { authRouter };
