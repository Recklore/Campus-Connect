const crypto = require("crypto");
const { auditLogModel } = require("../models/auditLog");
const { getClientIp } = require("../lib/ipExtraction");
const { userModel } = require("../models/user");

const ENABLE_AUDIT = process.env.AUDIT_LOGGING_ENABLED !== "false"; // default: enabled


const getFailureReason = (statusCode) => {
  if (statusCode < 400) return null; // Not a failure

  if (statusCode === 400) return "validation_error";
  if (statusCode === 401) return "auth_failure";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 404) return "not_found";
  if (statusCode === 409) return "conflict";
  if (statusCode === 429) return "rate_limit_exceeded";
  if (statusCode >= 500) return "server_error";

  return "other";
};

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeString = (value, maxLen = 120) => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, maxLen);
};

const sanitizeValue = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item));
  }
  if (typeof value === "object") {
    return "[object]";
  }
  return safeString(value, 120);
};

const sanitizeObject = (input = {}) => {
  if (!input || typeof input !== "object") return undefined;
  const output = {};
  const blocked = new Set([
    "password",
    "passwordHash",
    "token",
    "refreshToken",
    "accessToken",
    "authorization",
    "cookie",
  ]);

  for (const [key, value] of Object.entries(input)) {
    if (blocked.has(String(key).toLowerCase())) continue;
    output[key] = sanitizeValue(value);
  }

  return Object.keys(output).length ? output : undefined;
};

const normalizeRouteKey = (req) => {
  const base = `${req.baseUrl || ""}${req.route?.path || req.path || req.originalUrl || ""}`;
  const withoutQuery = String(base).split("?")[0];
  return withoutQuery
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (OBJECT_ID_REGEX.test(segment) || UUID_REGEX.test(segment)) return ":id";
      if (/^\d+$/.test(segment)) return ":id";
      return segment;
    })
    .join("/");
};

const inferTarget = (req) => {
  if (req.auditTarget?.type) {
    return {
      targetType: req.auditTarget.type,
      targetId: req.auditTarget.id || null,
    };
  }

  const path = String(req.originalUrl || "").toLowerCase();
  const params = req.params || {};
  const body = req.body || {};

  if (path.includes("/admin/flags")) {
    const type = String(params.type || body.type || "").toLowerCase();
    if (type === "comment") {
      return { targetType: "Comment", targetId: params.id || body.id || null };
    }
    if (type === "discussion") {
      return { targetType: "DiscussionReply", targetId: params.id || body.id || null };
    }
    if (type === "post") {
      return { targetType: "Post", targetId: params.id || body.id || null };
    }
  }

  if (path.includes("/posts")) {
    const commentId = params.commentId || body.commentId || null;
    if (commentId) {
      return { targetType: "Comment", targetId: commentId };
    }
    return {
      targetType: "Post",
      targetId: params.id || params.postId || body.postId || body.id || null,
    };
  }

  if (path.includes("/discussions")) {
    const replyId = params.replyId || body.replyId || null;
    if (replyId) {
      return { targetType: "DiscussionReply", targetId: replyId };
    }
    return {
      targetType: "Discussion",
      targetId: params.id || params.discussionId || body.discussionId || body.id || null,
    };
  }

  if (path.includes("/users")) {
    return {
      targetType: "User",
      targetId: params.userId || params.id || body.userId || body.id || null,
    };
  }

  if (path.includes("/departments")) {
    return {
      targetType: "Department",
      targetId: params.departmentId || params.id || body.departmentId || body.id || null,
    };
  }

  if (path.includes("/subscriptions")) {
    return {
      targetType: "Subscription",
      targetId: params.subscriptionId || params.id || body.subscriptionId || body.id || null,
    };
  }

  return {
    targetType: "Unknown",
    targetId: params.id || body.id || null,
  };
};

const buildActionSummary = (actionType, routeKey, method) => {
  const routeToken = String(routeKey || "request")
    .replace(/[/:.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
  return `${actionType}_${String(method || "REQ").toUpperCase()}_${routeToken}`.slice(0, 200);
};

const buildEntitySnapshot = (req, targetType, targetId) => {
  if (req.auditEntitySnapshot && typeof req.auditEntitySnapshot === "object") {
    return sanitizeObject(req.auditEntitySnapshot);
  }

  const path = String(req.originalUrl || "").toLowerCase();
  const body = req.body || {};
  const snapshot = {
    targetType,
    targetId: targetId ? String(targetId) : undefined,
    scope: safeString(req.query?.scope, 40),
  };

  if (!path.includes("/auth")) {
    snapshot.title = safeString(body.title, 120);
    snapshot.bodyPreview = safeString(body.body, 160);
    snapshot.contentType = safeString(body.type, 40);
    snapshot.visibility = safeString(body.visibility, 40);
  }

  const sanitized = sanitizeObject(snapshot);
  return sanitized;
};

const getActorSnapshot = async (req) => {
  const fallback = {
    roleAtAction: req.user?.role,
    emailId: req.user?.emailId,
  };

  if (!req.user?._id) {
    return sanitizeObject(fallback);
  }

  try {
    const actor = await userModel
      .findById(req.user._id)
      .select("name emailId department role")
      .lean();

    return sanitizeObject({
      name: actor?.name,
      emailId: actor?.emailId || req.user?.emailId,
      department: actor?.department,
      roleAtAction: actor?.role || req.user?.role,
    });
  } catch (_) {
    return sanitizeObject(fallback);
  }
};

const auditLogger = (req, res, next) => {
  if (!ENABLE_AUDIT) return next();

  const requestId = safeString(req.headers["x-request-id"], 80) || crypto.randomUUID();
  req.requestId = requestId;
  if (!res.getHeader("x-request-id")) {
    res.setHeader("x-request-id", requestId);
  }

  let actionType = "ACCESS";
  switch (req.method) {
    case "POST":
      actionType = "CREATE";
      break;
    case "PUT":
    case "PATCH":
      actionType = "UPDATE";
      break;
    case "DELETE":
      actionType = "DELETE";
      break;
    default:
      actionType = "ACCESS";
  }


  res.on("finish", async () => {
    try {
      if (!req.user || !req.method) return;

      if (req.auditLogged) return;

      const routeKey = normalizeRouteKey(req);
      const { targetType, targetId } = inferTarget(req);
      const ip = getClientIp(req); // Use consistent IP extraction helper
      const { _id: actorId, role: actorRole } = req.user;
      const actorSnapshot = await getActorSnapshot(req);

      const statusCode = res.statusCode;
      const failureReason = getFailureReason(statusCode);
      const contentLength = Number(res.getHeader("content-length")) || undefined;

      const auditEntry = {
        actorId,
        actorRole,
        actionType,
        targetType,
        targetId: targetId || null,
        ipAddress: ip,
        requestId,
        requestPath: String(req.originalUrl || "").slice(0, 300),
        routeKey: safeString(routeKey, 300),
        requestMethod: req.method,
        actionSummary: buildActionSummary(actionType, routeKey, req.method),
        querySnapshot: sanitizeObject(req.query),
        paramsSnapshot: sanitizeObject(req.params),
        actorSnapshot,
        entitySnapshot: buildEntitySnapshot(req, targetType, targetId),
        responseSummary: sanitizeObject({
          statusClass: `${Math.floor(statusCode / 100)}xx`,
          contentLength,
          ...(req.auditResponseSummary || {}),
        }),
        statusCode,
      };

      // Only add failureReason if it's a failure (statusCode >= 400)
      if (failureReason) {
        auditEntry.failureReason = failureReason;
      }

      // Optional: add meta for additional context (validation error count, specific error type, etc.)
      // Keep this minimal and whitelisted to avoid logging sensitive data
      if (statusCode === 400 && req.validationErrors) {
        auditEntry.meta = { validationErrorCount: req.validationErrors.length };
      } else if (statusCode === 401 && req.authErrorType) {
        auditEntry.meta = { authErrorType: req.authErrorType }; // e.g., "expired", "invalid"
      }

      await auditLogModel.create(auditEntry);
    } catch (error) {
      console.error("Error saving audit log:", error);
    }
  });

  next();
};

module.exports = { auditLogger };
