const mongoose = require("mongoose");
const { Schema } = mongoose;

const subscriptionSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "departments",
      required: true,
    },
  },
  { timestamps: true },
);

subscriptionSchema.index({ user: 1, department: 1 }, { unique: true });

const subscriptionModel = mongoose.model("subscriptions", subscriptionSchema);

module.exports = { subscriptionModel };
