const adminRouter = require("express").Router();
const { verifyAccessToken, requireRole } = require("../middleware/verifyAccessToken");
const { auditLogModel } = require("../models/auditLog");
const { postModel } = require("../models/post");
const { userModel } = require("../models/user");
const { departmentModel } = require("../models/department");
const Discussion = require("../models/discussion");
const { notificationModel } = require("../models/notification");
const { promoteUser, demoteUser, getFlags, getFlagDetail, approveFlag, rejectFlag, restoreFlag } = require("../controller/adminController");

const buildAuditLogFilter = (query = {}) => {
  const {
    actorId,
    actionType,
    targetType,
    routeKey,
    requestMethod,
    requestId,
    actionSummary,
    hasTargetId,
    minStatus,
    maxStatus,
    createdAfter,
    createdBefore,
  } = query;
  const filter = {};

  if (actorId) {
    filter.actorId = actorId;
  }

  if (actionType) {
    filter.actionType = actionType;
  }

  if (targetType) {
    filter.targetType = targetType;
  }

  if (routeKey) {
    filter.routeKey = routeKey;
  }

  if (requestMethod) {
    filter.requestMethod = requestMethod.toUpperCase();
  }

  if (requestId) {
    filter.requestId = requestId;
  }

  if (actionSummary) {
    filter.actionSummary = { $regex: actionSummary, $options: "i" };
  }

  if (hasTargetId === "true") {
    filter.targetId = { $ne: null };
  } else if (hasTargetId === "false") {
    filter.targetId = null;
  }

  if (minStatus || maxStatus) {
    filter.statusCode = {};
    if (minStatus) filter.statusCode.$gte = Number(minStatus);
    if (maxStatus) filter.statusCode.$lte = Number(maxStatus);
  }

  if (createdAfter || createdBefore) {
    const createdAt = {};
    if (createdAfter) {
      const parsed = new Date(createdAfter);
      if (!Number.isNaN(parsed.getTime())) createdAt.$gte = parsed;
    }
    if (createdBefore) {
      const parsed = new Date(createdBefore);
      if (!Number.isNaN(parsed.getTime())) createdAt.$lte = parsed;
    }
    if (Object.keys(createdAt).length) {
      filter.createdAt = createdAt;
    }
  }

  return filter;
};

adminRouter.get(
  "/stats",
  verifyAccessToken,
  requireRole("univ_admin"),
  async (req, res) => {
    try {
      const now = new Date();
      const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now - 30 * 24 * 60 * 60 * 1000);

      // User statistics by role
      const userStatsByRole = await userModel.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      const totalUsers = await userModel.countDocuments({ isActive: true });

      // Total counts
      const totalPosts = await postModel.countDocuments({ isDeleted: false });
      const totalDiscussions = await Discussion.countDocuments({ isDeleted: false });
      const totalDepartments = await departmentModel.countDocuments();
      const totalNotifications = await notificationModel.countDocuments();

      // Weekly activity
      const postsLastWeek = await postModel.countDocuments({
        createdAt: { $gte: lastWeek },
        isDeleted: false,
      });

      const discussionsLastWeek = await Discussion.countDocuments({
        createdAt: { $gte: lastWeek },
        isDeleted: false,
      });

      // Monthly activity for trends
      const postsLastMonth = await postModel.countDocuments({
        createdAt: { $gte: lastMonth },
        isDeleted: false,
      });

      const discussionsLastMonth = await Discussion.countDocuments({
        createdAt: { $gte: lastMonth },
        isDeleted: false,
      });

      // Top departments by post count
      const topDepartmentsByPosts = await postModel.aggregate([
        {
          $match: { isDeleted: false, department: { $ne: null } },
        },
        {
          $group: {
            _id: "$department",
            postCount: { $sum: 1 },
          },
        },
        {
          $sort: { postCount: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "departmentInfo",
          },
        },
        {
          $unwind: { path: "$departmentInfo", preserveNullAndEmptyArrays: true },
        },
      ]);

      // Top departments by discussion count
      const topDepartmentsByDiscussions = await Discussion.aggregate([
        {
          $match: { isDeleted: false, department: { $ne: null } },
        },
        {
          $group: {
            _id: "$department",
            discussionCount: { $sum: 1 },
          },
        },
        {
          $sort: { discussionCount: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "departmentInfo",
          },
        },
        {
          $unwind: { path: "$departmentInfo", preserveNullAndEmptyArrays: true },
        },
      ]);

      // Recent activity timeline (last 7 days aggregated by day)
      const activityTimeline = await postModel.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            postCount: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Unread notification stats
      const unreadNotifications = await notificationModel.countDocuments({
        isRead: false,
      });

      return res.status(200).json({
        success: true,
        data: {
          summary: {
            totalUsers,
            totalPosts,
            totalDiscussions,
            totalDepartments,
            totalNotifications,
          },
          usersByRole: userStatsByRole,
          weeklyActivity: {
            postsLastWeek,
            discussionsLastWeek,
          },
          monthlyActivity: {
            postsLastMonth,
            discussionsLastMonth,
          },
          topDepartmentsByPosts: topDepartmentsByPosts.map((dept) => ({
            departmentId: dept._id,
            departmentName: dept.departmentInfo?.deptName || "Unknown",
            postCount: dept.postCount,
          })),
          topDepartmentsByDiscussions: topDepartmentsByDiscussions.map((dept) => ({
            departmentId: dept._id,
            departmentName: dept.departmentInfo?.deptName || "Unknown",
            discussionCount: dept.discussionCount,
          })),
          activityTimeline,
          unreadNotifications,
        },
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },
);

adminRouter.get(
  "/auditlogs",
  verifyAccessToken,
  requireRole("univ_admin"),
  async (req, res) => {
    try {
      const { limit = 20, skip = 0 } = req.query;
      const filter = buildAuditLogFilter(req.query);

      const auditLogs = await auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .populate("actorId", "name role"); // Populate actor details

      const totalCount = await auditLogModel.countDocuments(filter);

      return res.status(200).json({
        success: true,
        data: auditLogs,
        totalCount,
        limit: Number(limit),
        skip: Number(skip),
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return res
        .status(500)
        .json({ success: false, message: "internal server error" });
    }
  },
);

adminRouter.get(
  "/auditlogs/export",
  verifyAccessToken,
  requireRole("univ_admin"),
  async (req, res) => {
    try {
      const filter = buildAuditLogFilter(req.query);

      const auditLogs = await auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .populate("actorId", "name role")
        .lean();

      const exportPayload = {
        success: true,
        generatedAt: new Date().toISOString(),
        totalCount: auditLogs.length,
        filters: filter,
        data: auditLogs,
      };

      const fileName = `audit-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      return res.status(200).send(JSON.stringify(exportPayload, null, 2));
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      return res
        .status(500)
        .json({ success: false, message: "internal server error" });
    }
  },
);
adminRouter.get(
  "/objections",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  async (req, res) => {
    try {
      const { limit = 20, skip = 0, status = "objected" } = req.query;
      const filter = {
        isDeleted: false,
      };

      if (status) {
        filter.status = status;
      }

      const posts = await postModel
        .find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .populate("author", "name role designation department emailId")
        .populate("department", "deptName deptCode school")
        .populate("objections.raisedBy", "name role designation department emailId");

      const totalCount = await postModel.countDocuments(filter);

      return res.status(200).json({
        success: true,
        data: posts,
        totalCount,
        limit: Number(limit),
        skip: Number(skip),
      });
    } catch (error) {
      console.error("Error fetching objection posts:", error);
      return res
        .status(500)
        .json({ success: false, message: "internal server error" });
    }
  },
);

// Role management endpoints
adminRouter.post(
  "/users/:userId/promote",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  promoteUser,
);

adminRouter.post(
  "/users/:userId/demote",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  demoteUser,
);

// Moderation flags endpoints
adminRouter.get(
  "/flags",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  getFlags,
);

adminRouter.get(
  "/flags/:type/:id",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  getFlagDetail,
);

adminRouter.post(
  "/flags/:type/:id/approve",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  approveFlag,
);

adminRouter.post(
  "/flags/:type/:id/reject",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  rejectFlag,
);

adminRouter.post(
  "/flags/:type/:id/restore",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  restoreFlag,
);

module.exports = { adminRouter };
