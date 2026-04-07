const deptRouter = require("express").Router();
const { verifyAccessToken } = require("../middleware/verifyAccessToken");
const { authLimiter } = require("../middleware/rateLimiters");
const {
  getAllDepartments,
  getMySubscription,
  toggleSubscription,
} = require("../controller/deptController");

deptRouter.get("/", verifyAccessToken, getAllDepartments);
deptRouter.get("/subscriptions", verifyAccessToken, authLimiter, getMySubscription);
deptRouter.get("/:id/subscribe", verifyAccessToken, authLimiter, toggleSubscription);

module.exports = { deptRouter }