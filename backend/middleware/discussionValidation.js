const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

// Sanitize HTML with minimal allowed tags
const sanitizeDiscussionBody = (dirty) => {
  return sanitizeHtml(dirty, {
    allowedTags: ['b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'br', 'p', 'a'],
    allowedAttributes: {
      a: ['href', 'title'],
    },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard',
  });
};

// Sanitize plain text (remove HTML entirely)
const sanitizePlainText = (text) => {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
    .substring(0, 3000); // Limit to 3000 chars
};

// Validation rules
const validateDiscussionCreate = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-:?!.,&()'"]+$/)
    .withMessage('Title contains invalid characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('body')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Body must be between 10 and 5000 characters'),
  
  body('visibility')
    .optional()
    .isIn(['global', 'department'])
    .withMessage('Visibility must be either "global" or "department"'),
  
  body('department')
    .optional()
    .isMongoId()
    .withMessage('Invalid department ID'),
];

const validateReplyCreate = [
  body('body')
    .trim()
    .isLength({ min: 5, max: 3000 })
    .withMessage('Reply must be between 5 and 3000 characters'),
  body('parentThought')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage('Invalid parent thought ID'),
];

const validateDiscussionEdit = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-:?!.,&()'"]+$/)
    .withMessage('Title contains invalid characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('body')
    .optional()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Body must be between 10 and 5000 characters'),
  
  body('visibility')
    .optional()
    .isIn(['global', 'department'])
    .withMessage('Visibility must be either "global" or "department"'),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

// Middleware to sanitize request body
const sanitizeDiscussion = (req, res, next) => {
  if (req.body.body) {
    req.body.body = sanitizeDiscussionBody(req.body.body);
  }
  if (req.body.title) {
    req.body.title = req.body.title.trim().substring(0, 200);
  }
  if (req.body.description) {
    req.body.description = sanitizePlainText(req.body.description);
  }
  next();
};

const sanitizeReply = (req, res, next) => {
  if (req.body.body) {
    req.body.body = sanitizeDiscussionBody(req.body.body);
  }
  next();
};

module.exports = {
  validateDiscussionCreate,
  validateReplyCreate,
  validateDiscussionEdit,
  handleValidationErrors,
  sanitizeDiscussion,
  sanitizeReply,
};
