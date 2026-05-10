const mongoose = require("mongoose");

const objectionReplySchema = new mongoose.Schema(
  {
    objectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Objection"
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Post"
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = {
  objectionReplyModel: mongoose.model("ObjectionReply", objectionReplySchema)
};
