const mongoose = require("mongoose");
const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "posts",
      required: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      minLength: 2,
      maxLength: 2000,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "post_comments",
      default: null,
    },

    isOfficial: {
      type: Boolean,
      default: false,
    },

    moderationStatus: {
      type: String,
      enum: ["visible", "flagged", "soft_deleted", "deleted"],
      default: "visible",
    },
    isToxic: {
      type: Boolean,
      default: false,
    },
    toxicityScore: {
      type: Number,
      default: 0,
    },
    flaggedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    flaggedAt: {
      type: Date,
      default: null,
    },
    flagReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, isDeleted: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ post: 1, parentComment: 1, createdAt: 1 });

const commentModel = mongoose.model("post_comments", commentSchema);

module.exports = { commentModel };
