const express = require("express");
const discussionController = require("../controller/discussionController.js");
const {
  verifyAccessToken,
  requireRole,
} = require("../middleware/verifyAccessToken.js");
const {
  validateDiscussionCreate,
  validateReplyCreate,
  validateDiscussionEdit,
  handleValidationErrors,
  sanitizeDiscussion,
  sanitizeReply,
} = require("../middleware/discussionValidation.js");

const discussionRouter = express.Router();

// Public routes (no auth required, but auth enhances functionality)
discussionRouter.get("/", discussionController.getDiscussions);
discussionRouter.get("/:id", discussionController.getDiscussionDetail);

// Protected routes (senior+ only)
discussionRouter.post(
  "/",
  verifyAccessToken,
  requireRole("senior", "dept_admin", "univ_admin"),
  validateDiscussionCreate,
  handleValidationErrors,
  sanitizeDiscussion,
  discussionController.createDiscussion,
);

discussionRouter.put(
  "/:id",
  verifyAccessToken,
  validateDiscussionEdit,
  handleValidationErrors,
  sanitizeDiscussion,
  discussionController.editDiscussion,
);

discussionRouter.delete(
  "/:id",
  verifyAccessToken,
  discussionController.deleteDiscussion,
);

// Reply routes
discussionRouter.post(
  "/:id/replies",
  verifyAccessToken,
  requireRole("senior_dept_admin", "univ_admin"),
  validateReplyCreate,
  handleValidationErrors,
  sanitizeReply,
  discussionController.addReply,
);

// Thought routes (preferred naming)
discussionRouter.post(
  "/:id/thoughts",
  verifyAccessToken,
  requireRole("senior_dept_admin", "univ_admin"),
  validateReplyCreate,
  handleValidationErrors,
  sanitizeReply,
  discussionController.addReply,
);

discussionRouter.put(
  "/:id/replies/:replyId",
  verifyAccessToken,
  validateReplyCreate,
  handleValidationErrors,
  sanitizeReply,
  discussionController.editReply,
);

discussionRouter.put(
  "/:id/thoughts/:replyId",
  verifyAccessToken,
  validateReplyCreate,
  handleValidationErrors,
  sanitizeReply,
  discussionController.editReply,
);

discussionRouter.delete(
  "/:id/replies/:replyId",
  verifyAccessToken,
  discussionController.deleteReply,
);

discussionRouter.delete(
  "/:id/thoughts/:replyId",
  verifyAccessToken,
  discussionController.deleteReply,
);

module.exports = { discussionRouter };
