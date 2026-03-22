const { body, param, query, validationResult } = require("express-validator");

// ─── Generic error payloads ───────────────────────────────────────────────────
// Intentionally vague to prevent user enumeration, credential stuffing hints,
// and any other information-leakage attacks.

const BAD_REQUEST    = { success: false, message: "Bad request" };
const INVALID_CREDS  = { success: false, message: "Invalid credentials" };
const INVALID_TOKEN  = { success: false, message: "Invalid token" };

// ─── Core validation runner ───────────────────────────────────────────────────
/**
 * Returns a middleware that checks for validation errors and responds with a
 * single, opaque error payload — no field names, no hint about what failed.
 *
 * @param {object} errorResponse  One of the generic payloads above.
 */
const validate = (errorResponse) => (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(errorResponse);
  }
  next();
};

// ─── Sanitisation ─────────────────────────────────────────────────────────────
/**
 * Whitelist-based body sanitiser.
 * Strips every key that is not explicitly listed so the controller never sees
 * unexpected / polluted fields.
 *
 * @param {string[]} allowedFields
 */
const sanitizeRequest = (allowedFields) => (req, res, next) => {
  const sanitized = {};
  allowedFields.forEach((field) => {
    if (field in req.body) sanitized[field] = req.body[field];
  });
  req.body = sanitized;
  next();
};

// ─── Signup rules ─────────────────────────────────────────────────────────────
/**
 * Validates and sanitises the signup request body.
 *
 * Accepted shapes:
 *   { role: "student", enrollmentNumber: string, password: string }
 *   { role: "senior",  emailId: string,          password: string }
 *
 * All error messages are intentionally uniform ("Bad request") so that
 * automated probing cannot distinguish between a bad role, a bad enrollment
 * number, a bad email, or a bad password.
 */
const signupInitRules = [
  sanitizeRequest(["role", "enrollmentNumber", "emailId", "password"]),

  body("role")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toLowerCase()
    .isIn(["student", "senior"])
    .withMessage("Bad request")
    .escape(),

  // Only validated when role === "student"
  body("enrollmentNumber")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toUpperCase()
    .isLength({ min: 10, max: 14 })
    .withMessage("Bad request")
    .matches(/^\d{4}[A-Z]{4,6}\d{3}$/)
    .withMessage("Bad request")
    .escape(),

  // Only validated when role === "senior"
  body("emailId")
    .if(body("role").equals("senior"))
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toLowerCase()
    .isLength({ min: 13, max: 50 })
    .withMessage("Bad request")
    .isEmail()
    .withMessage("Bad request")
    .normalizeEmail()
    .custom((v) => {
      if (!v.endsWith("@curaj.ac.in")) throw new Error("Bad request");
      return true;
    })
    .escape(),

  // Full password-strength check is appropriate at signup.
  // At login we intentionally skip complexity checks (see loginRules).
  body("password")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .isLength({ min: 8, max: 64 })
    .withMessage("Bad request")
    .matches(/[A-Z]/)
    .withMessage("Bad request")
    .matches(/[a-z]/)
    .withMessage("Bad request")
    .matches(/[0-9]/)
    .withMessage("Bad request")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Bad request")
    .escape(),

  validate(BAD_REQUEST),
];

// ─── Login rules ──────────────────────────────────────────────────────────────
/**
 * Validates and sanitises the login request body.
 *
 * Accepted shapes:
 *   { role: "student", enrollmentNumber: string, password: string }
 *   { role: "senior",  emailId: string,          password: string }
 *
 * NOTE: dept_admin / univ_admin are excluded here because the controller does
 * not handle them in the current login implementation. Add them back once the
 * controller branch is in place.
 *
 * All errors collapse to "Invalid credentials" — never leak which field
 * failed, whether a user exists, or what the password policy is.
 *
 * Password complexity rules are intentionally omitted at login:
 * they would let an attacker infer the policy without ever authenticating.
 */
const loginRules = [
  sanitizeRequest(["role", "enrollmentNumber", "emailId", "password"]),

  body("role")
    .notEmpty()
    .withMessage("Invalid credentials")
    .isString()
    .withMessage("Invalid credentials")
    .trim()
    .toLowerCase()
    .isIn(["student", "senior"])
    .withMessage("Invalid credentials")
    .escape(),

  // Only validated when role === "student"
  body("enrollmentNumber")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Invalid credentials")
    .isString()
    .withMessage("Invalid credentials")
    .trim()
    .toUpperCase()
    .isLength({ min: 10, max: 14 })
    .withMessage("Invalid credentials")
    .matches(/^\d{4}[A-Z]{4,6}\d{3}$/)
    .withMessage("Invalid credentials")
    .escape(),

  // Only validated when role !== "student"
  body("emailId")
    .if(body("role").not().equals("student"))
    .notEmpty()
    .withMessage("Invalid credentials")
    .isString()
    .withMessage("Invalid credentials")
    .trim()
    .toLowerCase()
    .isLength({ min: 13, max: 50 })
    .withMessage("Invalid credentials")
    .isEmail()
    .withMessage("Invalid credentials")
    .normalizeEmail()
    .custom((v) => {
      if (!v.endsWith("@curaj.ac.in")) throw new Error("Invalid credentials");
      return true;
    })
    .escape(),

  // Basic presence + length only — no complexity rules (see note above)
  body("password")
    .notEmpty()
    .withMessage("Invalid credentials")
    .isString()
    .withMessage("Invalid credentials")
    .trim()
    .isLength({ min: 8, max: 64 })
    .withMessage("Invalid credentials")
    .escape(),

  validate(INVALID_CREDS),
];

// ─── Verify rules ─────────────────────────────────────────────────────────────
/**
 * Validates the token URL parameter for the email-verification endpoint.
 * Token must be a 64-character lowercase hex string (SHA-256 raw token).
 */
const signupVerifyRules = [
  param("token")
    .optional()
    .notEmpty()
    .withMessage("Invalid token")
    .isString()
    .withMessage("Invalid token")
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token")
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("Invalid token")
    .escape(),

  query("token")
    .optional()
    .notEmpty()
    .withMessage("Invalid token")
    .isString()
    .withMessage("Invalid token")
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token")
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("Invalid token")
    .escape(),

  (req, res, next) => {
    if (req.params.token || req.query.token) {
      return next();
    }
    return res.status(400).json(INVALID_TOKEN);
  },

  validate(INVALID_TOKEN),
];

// ─── Forgot-password init rules ──────────────────────────────────────────────
/**
 * Validates and sanitises forgot-password init request body.
 *
 * Accepted shapes:
 *   { role: "student", enrollmentNumber: string }
 *   { role: "senior",  emailId: string }
 */
const forgotPasswordInitRules = [
  sanitizeRequest(["role", "enrollmentNumber", "emailId"]),

  body("role")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toLowerCase()
    .isIn(["student", "senior"])
    .withMessage("Bad request")
    .escape(),

  body("enrollmentNumber")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toUpperCase()
    .isLength({ min: 10, max: 14 })
    .withMessage("Bad request")
    .matches(/^\d{4}[A-Z]{4,6}\d{3}$/)
    .withMessage("Bad request")
    .escape(),

  body("emailId")
    .if(body("role").equals("senior"))
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .toLowerCase()
    .isLength({ min: 13, max: 50 })
    .withMessage("Bad request")
    .isEmail()
    .withMessage("Bad request")
    .normalizeEmail()
    .custom((v) => {
      if (!v.endsWith("@curaj.ac.in")) throw new Error("Bad request");
      return true;
    })
    .escape(),

  validate(BAD_REQUEST),
];

// ─── Forgot-password verify rules ───────────────────────────────────────────
/**
 * Validates forgot-password verification payload.
 * Requires token in URL param or query string and a strong new password.
 */
const forgotPasswordVerifyRules = [
  sanitizeRequest(["password"]),

  param("token")
    .optional()
    .notEmpty()
    .withMessage("Invalid token")
    .isString()
    .withMessage("Invalid token")
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token")
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("Invalid token")
    .escape(),

  query("token")
    .optional()
    .notEmpty()
    .withMessage("Invalid token")
    .isString()
    .withMessage("Invalid token")
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token")
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("Invalid token")
    .escape(),

  body("password")
    .notEmpty()
    .withMessage("Bad request")
    .isString()
    .withMessage("Bad request")
    .trim()
    .isLength({ min: 8, max: 64 })
    .withMessage("Bad request")
    .matches(/[A-Z]/)
    .withMessage("Bad request")
    .matches(/[a-z]/)
    .withMessage("Bad request")
    .matches(/[0-9]/)
    .withMessage("Bad request")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Bad request")
    .escape(),

  (req, res, next) => {
    if (req.params.token || req.query.token) {
      return next();
    }
    return res.status(400).json(INVALID_TOKEN);
  },

  (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const hasTokenError = errors.array().some(
      (error) =>
        error.path === "token" &&
        (error.location === "params" || error.location === "query"),
    );

    if (hasTokenError) {
      return res.status(400).json(INVALID_TOKEN);
    }

    return res.status(400).json(BAD_REQUEST);
  },
];

module.exports = {
  signupInitRules,
  loginRules,
  signupVerifyRules,
  forgotPasswordInitRules,
  forgotPasswordVerifyRules,
  sanitizeRequest,
};