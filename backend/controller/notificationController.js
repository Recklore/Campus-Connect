const { notificationModel } = require("../models/notification");

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { limit = 20, skip = 0, isRead } = req.query;

    const filter = { recipient: userId };
    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    const notifications = await notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .populate("postId", "title");

    const totalCount = await notificationModel.countDocuments(filter);
    const unreadCount = await notificationModel.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      totalCount,
      unreadCount,
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const markAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { notificationId } = req.params;

    const notification = await notificationModel.findOne({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "notification not found" });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("markAsRead error:", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const result = await notificationModel.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    return res.status(200).json({
      success: true,
      message: "all notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("markAllAsRead error:", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { notificationId } = req.params;

    const notification = await notificationModel.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "notification not found" });
    }

    return res.status(200).json({
      success: true,
      message: "notification deleted",
    });
  } catch (error) {
    console.error("deleteNotification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
