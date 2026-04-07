const { string } = require("joi");
const mongoose = require("mongoose");
const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    deptName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    deptCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },

    school: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    displayImage: {
      type: String,
      default: "",
      trim: true,
    },

    subscriberCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true },
);

departmentSchema.index({ school: 1 });
departmentSchema.index({ deptName: "text", deptCode: "text" });

const departmentModel = mongoose.model("departments", departmentSchema);

module.exports = { departmentModel };
