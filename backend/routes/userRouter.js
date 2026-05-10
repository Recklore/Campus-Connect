const userRouter = require("express").Router();
const {
  getMe,
  searchUsersAndDepartments,
  getUserProfileById,
} = require("../controller/userController");
const { verifyAccessToken, requireRole } = require("../middleware/verifyAccessToken");
const { authLimiter } = require("../middleware/rateLimiters");

userRouter.get("/me", verifyAccessToken, authLimiter, getMe);
userRouter.get(
  "/search",
  verifyAccessToken,
  authLimiter,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  searchUsersAndDepartments,
);
userRouter.get(
  "/:id/profile",
  verifyAccessToken,
  authLimiter,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  getUserProfileById,
);

module.exports = { userRouter };
