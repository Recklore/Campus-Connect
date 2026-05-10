const mongoose = require("mongoose");
const { Schema } = mongoose;

const postLikeSchema = new Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "posts",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true },
);

postLikeSchema.index({ post: 1, user: 1 }, { unique: true });
postLikeSchema.index({ user: 1, createdAt: -1 });

const postLikeModel = mongoose.model("post_likes", postLikeSchema);

module.exports = { postLikeModel };
