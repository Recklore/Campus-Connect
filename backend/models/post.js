const mongoose = require("mongoose");
const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    storedName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },

    size: {
      type: Number,
      required: true,
    },

    checksum: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
    },
  },
  { _id: true },
);

const postSchema = Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      minLength: 5,
      maxLength: 150,
    },

    body: {
      type: String,
      trim: true,
      required: true,
      minLength: 20,
      maxLength: 10000,
    },

    attachment: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: "A post cannot have more than 5 attachments",
      },
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
      required: true,
    },

    status: {
      type: String,
      required: true,
      enum: ["under_review", "official", "objected", "rejected"],
      default: "under_review",
    },

    reviewExpiresAt: {
      type: Date,
      required: true,
    },

    objections: [
      {
        raisedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
          required: true,
        },

        reason: {
          type: String,
          required: true,
          trim: true,
          minLength: 5,
          maxLength: 1000,
        },

        isResolved: {
          type: Boolean,
          required: true,
          default: false,
        },

        raisedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    commentCount: {
      type: Number,
      default: 0,
      min: 0,
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
  },
  { timestamps: true },
);

postSchema.index({ department: 1, status: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ status: 1, reviewExpiresAt: 1 });
postSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ title: "text", body: "text" });

const postModel = mongoose.model("posts", postSchema);

module.exports = { postModel };
