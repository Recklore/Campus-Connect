const mongoose = require('mongoose');

const discussionReplySchema = new mongoose.Schema(
  {
    discussion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },
    body: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 3000,
      trim: true,
    },
    parentThought: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscussionReply',
      default: null,
    },
    thoughtReplies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiscussionReply',
      },
    ],
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
    editedAt: {
      type: Date,
      default: null,
    },
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null,
    },
   
    moderationStatus: {
      type: String,
      enum: ['visible', 'flagged', 'soft_deleted', 'deleted'],
      default: 'visible',
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
        ref: 'users',
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
  {
    timestamps: true,
  }
);


discussionReplySchema.index({ discussion: 1, createdAt: 1 });
discussionReplySchema.index({ author: 1, createdAt: -1 });
discussionReplySchema.index({ discussion: 1, isDeleted: 1, createdAt: 1 });
discussionReplySchema.index({ parentThought: 1, createdAt: -1 });

const DiscussionReply = mongoose.model('DiscussionReply', discussionReplySchema);

module.exports = DiscussionReply;
