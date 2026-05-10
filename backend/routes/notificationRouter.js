const notificationRouter = require("express").Router();
const { verifyAccessToken } = require("../middleware/verifyAccessToken");
const { authLimiter } = require("../middleware/rateLimiters");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controller/notificationController");

notificationRouter.get(
  "/",
  verifyAccessToken,
  authLimiter,
  getNotifications,
);

notificationRouter.put(
  "/:notificationId/read",
  verifyAccessToken,
  authLimiter,
  markAsRead,
);

notificationRouter.put(
  "/read-all",
  verifyAccessToken,
  authLimiter,
  markAllAsRead,
);

notificationRouter.delete(
  "/:notificationId",
  verifyAccessToken,
  authLimiter,
  deleteNotification,
);

module.exports = { notificationRouter };
