const mongoose = require("mongoose");
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "POST_APPROVED",
        "POST_REJECTED",
        "OBJECTION_RAISED",
        "OBJECTION_RESOLVED",
        "CONTENT_APPROVED",
        "CONTENT_REJECTED",
        "CONTENT_RESTORED",
        "CONTENT_FLAGGED",
        "DISCUSSION_REPLY",
      ],
    },

    title: {
      type: String,
      required: true,
      maxLength: 200,
    },

    message: {
      type: String,
      required: true,
      maxLength: 1000,
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "posts",
      default: null,
    },

    actionUrl: {
      type: String,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

const notificationModel = mongoose.model("notifications", notificationSchema);

module.exports = { notificationModel };
