const postRouter = require("express").Router();
const {
  createPost,
  getPost,
  getFeed,
  getDepartmentPosts,
  getPublicPreview,
  deletePost,
} = require("../controller/postController");
const { upload, handleUploadError } = require("../middleware/upload");

const {
  verifyAccessToken,
  requireRole,
} = require("../middleware/verifyAccessToken");
const { authLimiter, guestLimiter } = require("../middleware/rateLimiters");

postRouter.get("/public/preview", guestLimiter, getPublicPreview);
postRouter.get("/department/:departmentId", guestLimiter, getDepartmentPosts);
postRouter.get("/feed", verifyAccessToken, authLimiter, getFeed);
postRouter.get("/:id", verifyAccessToken, authLimiter, getPost);
postRouter.post(
  "/",
  verifyAccessToken,
  requireRole("senior", "dept_admin", "univ_admin"),
  authLimiter,
  upload.array("attachments", 5),
  handleUploadError,
  createPost,
);
postRouter.delete("/:id", verifyAccessToken, authLimiter, deletePost);

module.exports = { postRouter };
