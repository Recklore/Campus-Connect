const mongoose = require("mongoose");
const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: function () {
        // actorId is required for authenticated users, but not for guest actions
        return this.actorRole !== "guest";
      },
      default: null,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ["student", "senior", "dept_admin", "univ_admin", "guest"],
    },
    actionType: {
      type: String,
      required: true,
      enum: ["CREATE", "UPDATE", "DELETE", "ACCESS"],
    },
    targetType: {
      type: String,
      required: true,
      enum: [
        "Post",
        "Comment",
        "User",
        "Department",
        "Subscription",
        "Discussion",
        "DiscussionReply",
        "Unknown",
      ],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      default: null,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    requestId: {
      type: String,
      required: false,
      trim: true,
      maxLength: 80,
    },
    requestPath: {
      type: String,
      required: false,
      trim: true,
      maxLength: 300,
    },
    routeKey: {
      type: String,
      required: false,
      trim: true,
      maxLength: 300,
    },
    requestMethod: {
      type: String,
      required: false,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    },
    actionSummary: {
      type: String,
      required: false,
      trim: true,
      maxLength: 200,
    },
    querySnapshot: {
      type: Object,
      required: false,
      description: "Sanitized request query snapshot for forensic/debug visibility.",
    },
    paramsSnapshot: {
      type: Object,
      required: false,
      description: "Sanitized request params snapshot for forensic/debug visibility.",
    },
    actorSnapshot: {
      type: Object,
      required: false,
      description:
        "Actor details captured at action time (name/email/department/role) for historical audits.",
    },
    entitySnapshot: {
      type: Object,
      required: false,
      description:
        "Optional target preview (whitelisted, length-capped) for actions without a stable targetId.",
    },
    responseSummary: {
      type: Object,
      required: false,
      description:
        "Small response summary (status class/content length/ids) without full payload data.",
    },
    statusCode: {
      type: Number,
      required: false,
      description: "HTTP response status code (2xx for success, 4xx/5xx for failure)",
    },
    failureReason: {
      type: String,
      required: false,
      enum: [
        "auth_failure",
        "validation_error",
        "forbidden",
        "not_found",
        "rate_limit_exceeded",
        "server_error",
        "conflict",
        "other",
      ],
      description: "Categorized reason for failure (if statusCode >= 400)",
    },
    meta: {
      type: Object,
      required: false,
      description:
        "Optional metadata about the request/failure (validation error count, auth error type, etc.). Whitelisted fields only to prevent secrets leaking.",
    },
    // macAddress: { // Omitted due to privacy concerns
    //   type: String,
    //   required: false,
    // },
  },
  { timestamps: true },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ routeKey: 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, createdAt: -1 });
auditLogSchema.index({ requestMethod: 1, createdAt: -1 });

const auditLogModel = mongoose.model("audit_logs", auditLogSchema);

module.exports = { auditLogModel };
