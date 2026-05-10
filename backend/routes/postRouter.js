const postRouter = require("express").Router();
const {
  createPost,
  getPost,
  getMyPost,
  getUserPosts,
  getFeed,
  getDepartmentPosts,
  getPublicPreview,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  editComment,
  markCommentAsOfficial,
  toggleCommentVisibility,
  deletePost,
  raiseObjection,
  resolveObjection,
  addObjectionReply,
  getObjectionReplies,
} = require("../controller/postController");
const { upload, handleUploadError, addChecksumToFiles } = require("../middleware/upload");
const {
  postIdRules,
  commentIdRules,
  createPostRules,
  createCommentRules,
} = require("../middleware/postValidation");

const {
  verifyAccessToken,
  requireRole,
} = require("../middleware/verifyAccessToken");
const { authLimiter, guestLimiter } = require("../middleware/rateLimiters");

postRouter.get("/public/preview", guestLimiter, getPublicPreview);
postRouter.get("/department/:departmentId", guestLimiter, getDepartmentPosts);
postRouter.get("/feed", verifyAccessToken, authLimiter, getFeed);
postRouter.get("/me", verifyAccessToken, authLimiter, getMyPost);
postRouter.get("/user/:userId", verifyAccessToken, authLimiter, getUserPosts);
postRouter.get("/:id", verifyAccessToken, authLimiter, postIdRules, getPost);
postRouter.get("/:id/comments", verifyAccessToken, authLimiter, postIdRules, getComments);
postRouter.post(
  "/",
  verifyAccessToken,
  requireRole("senior", "dept_admin", "univ_admin"),
  authLimiter,
  upload.array("attachments", 5),
  handleUploadError,
  addChecksumToFiles,
  ...createPostRules,
  createPost,
);
postRouter.post(
  "/:id/like",
  verifyAccessToken,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  toggleLike,
);
postRouter.post(
  "/:id/comments",
  verifyAccessToken,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  ...createCommentRules,
  addComment,
);
postRouter.delete(
  "/:id/comments/:commentId",
  verifyAccessToken,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  commentIdRules,
  deleteComment,
);
postRouter.post(
  "/:id/object",
  verifyAccessToken,
  requireRole("senior", "dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  raiseObjection,
);
postRouter.put(
  "/:id/resolveObjection",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  resolveObjection,
);

// Objection reply routes
postRouter.get(
  "/:id/objections/:objectionId/replies",
  verifyAccessToken,
  authLimiter,
  getObjectionReplies,
);

postRouter.post(
  "/:id/objections/:objectionId/replies",
  verifyAccessToken,
  authLimiter,
  addObjectionReply,
);

postRouter.put(
  "/:id/comments/:commentId",
  verifyAccessToken,
  requireRole("student", "senior", "dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  commentIdRules,
  ...createCommentRules,
  editComment,
);
postRouter.put(
  "/:id/comments/:commentId/official",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  commentIdRules,
  markCommentAsOfficial,
);
postRouter.put(
  "/:id/comments/:commentId/visibility",
  verifyAccessToken,
  requireRole("dept_admin", "univ_admin"),
  authLimiter,
  postIdRules,
  commentIdRules,
  toggleCommentVisibility,
);

module.exports = { postRouter };
