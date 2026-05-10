const { body, param, validationResult } = require("express-validator");

const BAD_REQUEST = { success: false, message: "Bad request" };

const validate = (errorResponse) => (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errorResponse);
  }
  next();
};

const sanitizeRequest = (allowedFields) => (req, res, next) => {
  const sanitized = {};
  allowedFields.forEach((field) => {
    if (field in req.body) sanitized[field] = req.body[field];
  });
  req.body = sanitized;
  next();
};

const postIdRules = [
  param("id").isMongoId().withMessage("Bad request"),
  validate(BAD_REQUEST),
];

const commentIdRules = [
  param("commentId").isMongoId().withMessage("Bad request"),
  validate(BAD_REQUEST),
];

const createPostRules = [
  sanitizeRequest(["title", "body"]),

  body("title")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .isLength({ min: 5, max: 150 })
    .withMessage("Bad request"),

  body("body")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .isLength({ min: 20, max: 10000 })
    .withMessage("Bad request"),

  validate(BAD_REQUEST),
];

const createCommentRules = [
  sanitizeRequest(["body"]),

  body("body")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .isLength({ min: 2, max: 2000 })
    .withMessage("Bad request"),

  validate(BAD_REQUEST),
];

module.exports = {
  postIdRules,
  commentIdRules,
  createPostRules,
  createCommentRules,
};
