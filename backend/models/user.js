const { required } = require("joi");

const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      minLength: 2,
      maxLength: 20,
      trim: true,
    },

    lastName: {
      type: String,
      minLength: 2,
      maxLength: 20,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    dob: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          const today = new Date();
          let age = today.getFullYear() - value.getFullYear();
          const m = today.getMonth() - value.getMonth();

          if (m < 0 || (m === 0 && today.getDate() < value.getDate())) {
            age--;
          }

          return age >= 15 && age <= 99;
        },
        message: "Age must be between 15 and 99",
      },
    },

    emailId: {
      type: String,
      required: true,
      unique: true,
      minLength: 13,
      maxLength: 50,
      lowercase: true,
      trim: true,
    },

    enrollmentId: {
      type: String,
      required: true,
      unique: true,
      minLength: 10,
      maxLength: 14,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minLength: 8,
      maxLength: 100,
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    isSenior: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const userModel = mongoose.model("users", userSchema);

module.exports = { userModel };
