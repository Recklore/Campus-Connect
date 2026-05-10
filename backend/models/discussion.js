const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 200,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true,
      default: null,
    },
    body: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 5000,
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'departments',
      default: null,
    },
    visibility: {
      type: String,
      enum: ['global', 'department'],
      default: 'global',
    },
    status: {
      type: String,
      enum: ['active', 'locked', 'resolved'],
      default: 'active',
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null,
    },
    replyCount: {
      type: Number,
      default: 0,
    },
    thoughtCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

discussionSchema.index({ department: 1, createdAt: -1 });
discussionSchema.index({ author: 1, createdAt: -1 });
discussionSchema.index({ status: 1, visibility: 1, createdAt: -1 });
discussionSchema.index({ pinnedAt: -1, status: 1, createdAt: -1 });
discussionSchema.index({ isDeleted: 1, createdAt: -1 });

discussionSchema.virtual('isPinned').get(function () {
  return this.pinnedAt !== null;
});

const Discussion = mongoose.model('Discussion', discussionSchema);

module.exports = Discussion;
