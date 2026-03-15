const Joi = require("joi");

const signupValidation = (req, res, next) => {
  const userValidationSchema = Joi.object({
    firstName: Joi.string().min(2).max(20).required(),

    lastName: Joi.string().min(2).max(20).optional(),

    gender: Joi.string().valid("male", "female", "other").required(),

    dob: Joi.date().less("now").required(),

    emailId: Joi.string()
      .email()
      .custom((value, helpers) => {
        if (!value.endsWith("@curaj.ac.in")) {
          return helpers.message("Email must belong to curaj.ac.in domain");
        }
        return value;
      })
      .min(13)
      .max(50)
      .required(),

    enrollmentId: Joi.string().min(10).max(14).required(),

    password: Joi.string().min(8).max(20).required(),

    isAdmin: Joi.boolean().default(false),

    isSenior: Joi.boolean().default(false),
  });

  const { error } = userValidationSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: "Bad request", error });
  }

  next();
};

const loginValidation = (req, res, next) => {
  const userValidationSchema = Joi.object({
    emailId: Joi.string()
      .email()
      .custom((value, helpers) => {
        if (!value.endsWith("@curaj.ac.in")) {
          return helpers.message("Invalid credentials");
        }
        return value;
      })
      .min(13)
      .max(50)
      .required(),

    enrollmentId: Joi.string().min(10).max(14).required(),

    password: Joi.string().min(8).max(20).required(),
  }).or("emailId", "enrollmentId");

  const { error } = userValidationSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: "Bad request", error });
  }

  next();
};

module.exports = { loginValidation, signupValidation };
