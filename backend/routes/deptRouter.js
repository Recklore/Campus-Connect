const deptRouter = require("express").Router();
const { verifyAccessToken } = require("../middleware/verifyAccessToken");
const { authLimiter } = require("../middleware/rateLimiters");
const {
  getAllDepartments,
  getMySubscription,
  toggleSubscription,
  getDepartmentById,
} = require("../controller/deptController");

deptRouter.get("/", verifyAccessToken, getAllDepartments);
deptRouter.get("/subscriptions", verifyAccessToken, authLimiter, getMySubscription);
deptRouter.get("/:id", verifyAccessToken, authLimiter, getDepartmentById);
deptRouter.post("/:id/subscribe", verifyAccessToken, authLimiter, toggleSubscription);
deptRouter.delete("/:id/subscribe", verifyAccessToken, authLimiter, toggleSubscription);

module.exports = { deptRouter }
