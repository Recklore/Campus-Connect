const mongoose = require("mongoose");
const { Schema } = mongoose;

const ROLE_LEVELS = {
  guest: 0,
  student: 1,
  senior: 2,
  dept_admin: 3,
  univ_admin: 4,
};

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: 2,
      maxLength: 20,
      trim: true,
    },

    // gender: {
    //   type: String,
    //   enum: ["male", "female", "other"],
    //   required: true,
    // },

    dob: {
      type: Date,
      // required: true,
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
      index: true,
      minLength: 13,
      maxLength: 50,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => v.endsWith("@curaj.ac.in"),
        message: "Invalid email",
      },
    },

    passwordHash: {
      type: String,
      required: true,
    },

    enrollmentNumber: {
      type: String,
      sparse: true,
      unique: true,
      uppercase: true,
      minLength: 10,
      maxLength: 14,
      trim: true,
    },

    employeeId: {
      type: String,
      sparse: true,
      unique: true,
      uppercase: true,
      minLength: 8,
      maxLength: 14,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      default: "guest",
      enum: ["guest", "student", "senior", "dept_admin", "univ_admin"],
    },

    roleLevel: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 4,
    },

    designation: {
      type: String,
      enum: [null, "Assistant Professor", "Associate Professor", "Professor"],
      default: null,
    },

    adminOf: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Department",
      default: [],
    },

    department: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ adminOf: 1 });

userSchema.pre("save", function () {
  this.roleLevel = ROLE_LEVELS[this.role] ?? 0;
});

userSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (update.role) {
    update.roleLevel = ROLE_LEVELS[update.role] ?? 0;
  }
});

const userModel = mongoose.model("users", userSchema);

module.exports = { userModel, ROLE_LEVELS };
