const { postModel } = require("../models/post");
const { departmentModel } = require("../models/department");
const { subscriptionModel } = require("../models/subscription");
const { postLikeModel } = require("../models/postLike");
const { commentModel } = require("../models/comment");
const { userModel } = require("../models/user");
const { cloudinary, hasCloudinaryConfig } = require("../config/cloudinary");
const {
  sendObjectionRaisedEmail,
  sendObjectionResolvedEmail,
  sendPostDeletedByAdminEmail,
} = require("../services/mailNotificationService");
const { notifyObjectionRaised, notifyObjectionResolved, createNotification } = require("../services/notificationService");
const { analyzeText } = require("../services/toxicityScanner");
const { sendContentFlaggedEmail } = require("../services/mailNotificationService");
const { auditLogModel } = require("../models/auditLog");

const CLOUDINARY_POSTS_FOLDER = "campus-connect/posts";

const uploadFileToCloudinary = async (file) => {
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  return cloudinary.uploader.upload(dataUri, {
    folder: CLOUDINARY_POSTS_FOLDER,
    resource_type: "auto",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });
};

const deleteCloudinaryAsset = async (asset) => {
  if (!asset?.public_id) {
    return;
  }

  await cloudinary.uploader.destroy(asset.public_id, {
    resource_type: asset.resource_type || "image",
    invalidate: true,
  });
};

const FEATURED_POST_LIMIT = 5;
const FEATURED_DEPARTMENT_LIMIT = 5;
const FEED_PAGE_SIZE = 20;
const COMMENT_PAGE_SIZE = 20;

const FEED_SCOPES = {
  GENERAL: "general",
  PERSONAL: "personal",
  REVIEW: "review",
};

const REVIEWER_ROLES = new Set(["senior", "dept_admin", "univ_admin"]);

const canAccessReviewScope = (user) => REVIEWER_ROLES.has(user?.role);

const getFeedDefaultScope = (user) => {
  const hasAccount = Boolean(user?._id) && user?.role && user.role !== "guest";
  return hasAccount ? FEED_SCOPES.PERSONAL : FEED_SCOPES.GENERAL;
};

const resolveFeedScope = (user, requestedScope) => {
  const defaultScope = getFeedDefaultScope(user);
  const normalizedRequestedScope = String(requestedScope || "")
    .trim()
    .toLowerCase();

  if (!normalizedRequestedScope) {
    return defaultScope;
  }

  if (normalizedRequestedScope === FEED_SCOPES.GENERAL) {
    return FEED_SCOPES.GENERAL;
  }

  if (normalizedRequestedScope === FEED_SCOPES.PERSONAL) {
    return defaultScope === FEED_SCOPES.PERSONAL
      ? FEED_SCOPES.PERSONAL
      : FEED_SCOPES.GENERAL;
  }

  if (normalizedRequestedScope === FEED_SCOPES.REVIEW) {
    return canAccessReviewScope(user) ? FEED_SCOPES.REVIEW : defaultScope;
  }

  return defaultScope;
};

const parseCursorDate = (cursor) => {
  if (!cursor) {
    return null;
  }

  const date = new Date(cursor);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getEngagementPost = async (postId) => {
  const post = await postModel
    .findById(postId)
    .select("status isDeleted likeCount commentCount author");

  if (!post || post.isDeleted || post.status !== "official") {
    return null;
  }

  return post;
};

const getLikedPostSet = async (postIds, userObjectId) => {
  if (!userObjectId || postIds.length === 0) {
    return new Set();
  }

  const likes = await postLikeModel
    .find({ user: userObjectId, post: { $in: postIds } })
    .select("post")
    .lean();

  return new Set(likes.map((like) => String(like.post)));
};

const hydratePostsWithLikes = async (posts, userObjectId) => {
  if (!Array.isArray(posts)) {
    return [];
  }

  const plainPosts = posts.map((post) => post.toObject({ virtuals: true }));
  const postIds = posts.map((post) => post._id);
  const likedSet = await getLikedPostSet(postIds, userObjectId);

  return plainPosts.map((post) => ({
    ...post,
    likedByUser: likedSet.has(String(post._id)),
  }));
};

const buildFeedResult = (posts) => {
  const nextCursor =
    posts.length === FEED_PAGE_SIZE
      ? posts[posts.length - 1].createdAt.toISOString()
      : null;

  return {
    posts,
    nextCursor,
  };
};

const getGeneralFeedResult = async (cursorDate) => {
  const filter = {
    status: "official",
    isDeleted: false,
    ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
  };

  const posts = await postModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(FEED_PAGE_SIZE)
    .populate("author", "name role designation department")
    .populate("department", "deptName deptCode school");

  return buildFeedResult(posts);
};

const getPersonalFeedResult = async (userObjectId, cursorDate) => {
  const subscriptions = await subscriptionModel
    .find({ user: userObjectId })
    .select("department")
    .lean();

  const departmentIds = subscriptions.map((subscription) => subscription.department);

  if (departmentIds.length === 0) {
    return {
      posts: [],
      nextCursor: null,
      hasSubscriptions: false,
    };
  }

  const filter = {
    department: { $in: departmentIds },
    status: "official",
    isDeleted: false,
    ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
  };

  const posts = await postModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(FEED_PAGE_SIZE)
    .populate("author", "name role designation department")
    .populate("department", "deptName deptCode school");

  const result = buildFeedResult(posts);
  return {
    ...result,
    hasSubscriptions: true,
  };
};

const getReviewFeedResult = async (cursorDate) => {
  const filter = {
    status: { $in: ["under_review", "objected"] },
    isDeleted: false,
    ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
  };

  const posts = await postModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(FEED_PAGE_SIZE)
    .populate("author", "name role designation department")
    .populate("department", "deptName deptCode school");

  return buildFeedResult(posts);
};

const createPost = async (req, res) => {
  const uploadedAssets = [];

  try {
    const { title, body } = req.body;

    const role = req.user?.role ?? "guest";
    if (!["senior", "dept_admin", "univ_admin"].includes(role)) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    // Resolve department from author (req.user) — prefer value on token, fall back to DB.
    let departmentId = null;
    if (req.user?.department) {
      departmentId = req.user.department;
    } else if (req.user && req.user._id) {
      const author = await userModel.findById(req.user._id).select("department").lean();
      departmentId = author?.department || null;
    }

    // If we have a departmentId, verify it's active; otherwise leave department blank.
    if (departmentId) {
      const dept = await departmentModel.findOne({deptName: departmentId});
      if (!dept || !dept.isActive) {
        departmentId = null;
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length > 0 && !hasCloudinaryConfig()) {
      return res.status(500).json({
        success: false,
        message: "file upload service is not configured",
      });
    }

    for (const file of files) {
      const uploadedAsset = await uploadFileToCloudinary(file);
      uploadedAssets.push(uploadedAsset);
    }

    const attachment = files.map((file, index) => ({
      originalName: file.originalname,
      storedName: uploadedAssets[index].secure_url,
      mimeType: file.mimetype,
      size: file.size,
      checksum: file.checksum,
    }));

    const reviewExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const postPayload = {
      title,
      body,
      author: req.user._id,
      attachment,
      reviewExpiresAt: reviewExpireAt,
    };

    if (departmentId) {
      postPayload.department = departmentId;
    }

    const post = await postModel.create(postPayload);

    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    if (uploadedAssets.length > 0) {
      await Promise.allSettled(
        uploadedAssets.map((asset) => deleteCloudinaryAsset(asset)),
      );
    }

    console.error("createPost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await postModel
      .findOne({ _id: req.params.id, isDeleted: false })
      .populate("author", "name role designation department enrollmentNumber emailId")
      .populate("department", "deptName deptCode");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "post not found" });
    }

    const role = req.user?.role ?? "guest";
    const userObjectId = req.user?._id || null;

    if (post.status === "under_review") {
      const isPrivileged = ["senior", "dept_admin", "univ_admin"].includes(role);
      if (!isPrivileged) {
        return res
          .status(404)
          .json({ success: false, message: "post not found" });
      }
    }

    if (post.status === "objected" || post.status === "rejected") {
      const isAdmin = ["dept_admin", "univ_admin"].includes(role);
      const isPostAuthor = userObjectId && String(post.author?._id) === String(userObjectId);
      const isObjectionAuthor = userObjectId && post.objections.some(
        (objection) => String(objection?.raisedBy) === String(userObjectId),
      );
      const canSee = isAdmin || isPostAuthor || isObjectionAuthor;

      if (!canSee) {
        return res
          .status(404)
          .json({ success: false, message: "post not found" });
      }
    }

    const [payload] = await hydratePostsWithLikes([post], userObjectId);

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error("getPost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getMyPost = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    const { cursor } = req.query;

    const filter = {
      author: userObjectId,
      isDeleted: false,
      ...(cursor && { createdAt: { $lt: new Date(cursor) } }),
    };

    const posts = await postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("department", "deptName deptCode school")
      .populate("author", "name role designation department");

    const nextCursor =
      posts.length === 20
        ? posts[posts.length - 1].createdAt.toISOString()
        : null;

    const hydratedPosts = await hydratePostsWithLikes(posts, userObjectId);

    return res.status(200).json({
      success: true,
      data: hydratedPosts,
      nextCursor,
    });
  } catch (error) {
    console.error("getMyPost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cursor } = req.query;
    const currentUserObjectId = req.user?._id || null;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!["senior", "dept_admin", "univ_admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "User cannot create posts" });
    }

    const filter = {
      author: userId,
      isDeleted: false,
      status: "official",
      ...(cursor && { createdAt: { $lt: new Date(cursor) } }),
    };

    const posts = await postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("department", "deptName deptCode school")
      .populate("author", "name role designation department");

    const nextCursor =
      posts.length === 20
        ? posts[posts.length - 1].createdAt.toISOString()
        : null;

    const hydratedPosts = await hydratePostsWithLikes(posts, currentUserObjectId);

    return res.status(200).json({
      success: true,
      data: hydratedPosts,
      nextCursor,
    });
  } catch (error) {
    console.error("getUserPosts error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getFeed = async (req, res) => {
  try {
    const requestedScope = req.query.scope;
    const resolvedScope = resolveFeedScope(req.user, requestedScope);
    const cursorDate = parseCursorDate(req.query.cursor);
    const canSwitchScope = getFeedDefaultScope(req.user) === FEED_SCOPES.PERSONAL;
    const canReviewScope = canAccessReviewScope(req.user);
    const userObjectId = req.user?._id || null;

    let feedResult;
    if (resolvedScope === FEED_SCOPES.PERSONAL) {
      feedResult = await getPersonalFeedResult(req.user._id, cursorDate);
    } else if (resolvedScope === FEED_SCOPES.REVIEW) {
      feedResult = await getReviewFeedResult(cursorDate);
    } else {
      feedResult = await getGeneralFeedResult(cursorDate);
    }

    const hydratedPosts = await hydratePostsWithLikes(feedResult.posts, userObjectId);

    const payload = {
      success: true,
      data: hydratedPosts,
      nextCursor: feedResult.nextCursor,
      feedScope: resolvedScope,
      canSwitchScope,
      canReviewScope,
    };

    if (resolvedScope === FEED_SCOPES.PERSONAL) {
      payload.hasSubscriptions = feedResult.hasSubscriptions;
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("getFeed error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getDepartmentPosts = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    const { cursor } = req.query;

    const filter = {
      department: req.params.departmentId,
      status: "official",
      isDeleted: false,
      ...(cursor && { createdAt: { $lt: new Date(cursor) } }),
    };

    const posts = await postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("author", "role")
      .populate("department", "deptName deptCode");

    const nextCursor =
      posts.length === 20
        ? posts[posts.length - 1].createdAt.toISOString()
        : null;

    const hydratedPosts = await hydratePostsWithLikes(posts, userObjectId);

    return res.status(200).json({
      success: true,
      data: hydratedPosts,
      nextCursor,
    });
  } catch (error) {
    console.error("getDepartmentPosts error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getPublicPreview = async (req, res) => {
  try {
    const departments = await departmentModel
      .aggregate([
        { $match: { isActive: true } },
        { $sample: { size: FEATURED_DEPARTMENT_LIMIT } },
        {
          $project: {
            deptName: 1,
            deptCode: 1,
            school: 1,
            displayImage: 1,
          },
        },
      ]);

    const posts = await postModel.aggregate([
      { $match: { status: "official", isDeleted: false } },
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: "$department" },
      { $match: { "department.isActive": true } },
      {
        $addFields: {
          imageAttachments: {
            $filter: {
              input: "$attachment",
              as: "att",
              cond: {
                $regexMatch: {
                  input: "$att.mimeType",
                  regex: "^image/",
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          selectedAttachment: {
            $ifNull: [
              { $arrayElemAt: ["$imageAttachments", 0] },
              { $arrayElemAt: ["$attachment", 0] },
            ],
          },
        },
      },
      {
        $project: {
          title: 1,
          createdAt: 1,
          department: {
            _id: "$department._id",
            deptName: "$department.deptName",
            deptCode: "$department.deptCode",
            school: "$department.school",
          },
          selectedAttachment: {
            originalName: "$selectedAttachment.originalName",
            storedName: "$selectedAttachment.storedName",
            mimeType: "$selectedAttachment.mimeType",
            size: "$selectedAttachment.size",
          },
        },
      },
      { $sample: { size: FEATURED_POST_LIMIT } },
    ]);

    const departmentPreview = departments.map((department) => ({
      _id: department._id,
      deptName: department.deptName,
      deptCode: department.deptCode,
      school: department.school,
      displayImage: department.displayImage || "",
    }));

    const postPreview = posts.map((post) => ({
      _id: post._id,
      title: post.title,
      createdAt: post.createdAt,
      department: {
        _id: post.department._id,
        deptName: post.department.deptName,
        deptCode: post.department.deptCode,
        school: post.department.school,
      },
      selectedAttachment: post.selectedAttachment || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        departments: departmentPreview,
        posts: postPreview,
      },
    });
  } catch (error) {
    console.error("getPublicPreview error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const toggleLike = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const post = await getEngagementPost(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    const existing = await postLikeModel.findOne({ post: post._id, user: userObjectId });
    const baseLikeCount = Number(post.likeCount || 0);

    if (existing) {
      await existing.deleteOne();
      await postModel.updateOne(
        { _id: post._id, likeCount: { $gt: 0 } },
        { $inc: { likeCount: -1 } },
      );

      return res.status(200).json({
        success: true,
        liked: false,
        likeCount: Math.max(baseLikeCount - 1, 0),
      });
    }

    await postLikeModel.create({ post: post._id, user: userObjectId });
    await postModel.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } });

    return res.status(200).json({
      success: true,
      liked: true,
      likeCount: baseLikeCount + 1,
    });
  } catch (error) {
    console.error("toggleLike error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getComments = async (req, res) => {
  try {
    const post = await getEngagementPost(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    const cursorDate = parseCursorDate(req.query.cursor);
    const filter = {
      post: post._id,
      isDeleted: false,
      moderationStatus: 'visible',
      ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
    };

    const comments = await commentModel
      .find(filter)
      .sort({ parentComment: 1, createdAt: 1 })
      .limit(COMMENT_PAGE_SIZE)
      .populate("author", "name role designation department");

    const nextCursor =
      comments.length === COMMENT_PAGE_SIZE
        ? comments[comments.length - 1].createdAt.toISOString()
        : null;

    return res.status(200).json({
      success: true,
      data: comments,
      nextCursor,
    });
  } catch (error) {
    console.error("getComments error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const addComment = async (req, res) => {
try {
const userObjectId = req.user?._id || null;
if (!userObjectId) {
  return res.status(403).json({ success: false, message: "forbidden" });
}

const post = await getEngagementPost(req.params.id);
if (!post) {
  return res.status(404).json({ success: false, message: "post not found" });
}

const { body, parentComment } = req.body;

const isOfficialReply = req.user?.role === "senior";
    const analysis = await analyzeText(String(body || ''));
    const { score = 0, isToxic = false } = analysis || {};

    const commentData = {
      post: post._id,
      author: userObjectId,
      body: body,
      parentComment: parentComment || null,
      isOfficial: isOfficialReply,
      moderationStatus: isToxic ? 'flagged' : 'visible',
      isToxic: !!isToxic,
      toxicityScore: Number(score) || 0,
      flaggedAt: isToxic ? new Date() : null,
      flagReason: isToxic ? 'automated_toxicity_scan' : null,
    };

    const comment = await commentModel.create(commentData);


    if (comment.moderationStatus === 'visible') {
      await postModel.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
    }

    const populated = await commentModel
      .findById(comment._id)
      .populate("author", "name role designation department");

    if (comment.moderationStatus === 'flagged') {
      try {
        await createNotification(
          userObjectId,
          'CONTENT_FLAGGED',
          'Your comment was flagged for review',
          'Your comment was temporarily hidden and sent for admin review.',
          post._id,
          `/app/posts/${post._id}`,
        );

        const author = await userModel.findById(userObjectId).select('emailId name').lean();
        await sendContentFlaggedEmail(author, {
          contentSnippet: (String(body || '')).slice(0, 300),
          contentType: 'comment',
          score: comment.toxicityScore,
          itemUrl: `/app/posts/${post._id}`,
        });

        await auditLogModel.create({
          actorId: userObjectId,
          actorRole: req.user?.role || 'guest',
          actionType: 'CREATE',
          targetType: 'Comment',
          targetId: comment._id,
          ipAddress: req.ip,
          statusCode: 200,
          meta: { moderation: 'flagged', score: comment.toxicityScore },
        });
      } catch (err) {
        console.error('Error handling flagged comment notifications/audit:', err.message);
      }
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error("addComment error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const comment = await commentModel.findOne({
      _id: req.params.commentId,
      post: req.params.id,
      isDeleted: false,
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "comment not found" });
    }

    const role = req.user?.role ?? "guest";
    const isAuthor = String(comment.author) === String(userObjectId);
    const isAdmin = ["dept_admin", "univ_admin"].includes(role);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedBy = userObjectId;
    await comment.save();

    await postModel.updateOne(
      { _id: comment.post, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } },
    );

    return res.status(200).json({ success: true, message: "comment deleted" });
  } catch (error) {
    console.error("deleteComment error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const toggleCommentVisibility = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const comment = await commentModel.findOne({
      _id: req.params.commentId,
      post: req.params.id,
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "comment not found" });
    }

    const role = req.user?.role ?? "guest";
    const isAdmin = ["dept_admin", "univ_admin"].includes(role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    comment.isDeleted = !comment.isDeleted;
    comment.deletedAt = comment.isDeleted ? new Date() : null;
    comment.deletedBy = comment.isDeleted ? userObjectId : null;
    await comment.save();

    const increment = comment.isDeleted ? -1 : 1;
    await postModel.updateOne(
      { _id: comment.post, commentCount: { $gte: 0 } },
      { $inc: { commentCount: increment } },
    );

    const populated = await commentModel
      .findById(comment._id)
      .populate("author", "name role designation department");

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    console.error("toggleCommentVisibility error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const markCommentAsOfficial = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const comment = await commentModel.findOne({
      _id: req.params.commentId,
      post: req.params.id,
      isDeleted: false,
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "comment not found" });
    }

    const role = req.user?.role ?? "guest";
    const isAdmin = ["dept_admin", "univ_admin"].includes(role);

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    comment.isOfficial = !comment.isOfficial;
    await comment.save();

    const populated = await commentModel
      .findById(comment._id)
      .populate("author", "name role designation department");

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    console.error("markCommentAsOfficial error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const editComment = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { body } = req.body;
    if (!body || body.trim().length < 2) {
      return res.status(400).json({ success: false, message: "comment body is too short" });
    }

    const comment = await commentModel.findOne({
      _id: req.params.commentId,
      post: req.params.id,
      isDeleted: false,
    });

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "comment not found" });
    }

    const role = req.user?.role ?? "guest";
    const isAuthor = String(comment.author) === String(userObjectId);
    const isAdmin = ["dept_admin", "univ_admin"].includes(role);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    comment.body = body.trim();
    await comment.save();

    const populated = await commentModel
      .findById(comment._id)
      .populate("author", "name role designation department");

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    console.error("editComment error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .where("isDeleted")
      .equals(false)
      .populate("author", "name emailId");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "post not found" });
    }

    const role = req.user?.role ?? "guest";
    const isAuthor = String(post.author?._id) === String(req.user._id);
    const isAdmin = ["dept_admin", "univ_admin"].includes(role);
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = req.user._id;

    await post.save();

    if (isAdmin && !isAuthor && post.author?.emailId) {
      const adminUser = await userModel.findById(req.user._id).select("name role").lean();
      await sendPostDeletedByAdminEmail(post.author, post, adminUser);
    }

    return res.status(200).json({ success: true, message: "post deleted" });
  } catch (error) {
    console.error("deletePost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};



const raiseObjection = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: "reason for objection is too short" });
    }

    const post = await postModel.findById(req.params.id).populate("author", "name emailId role");

    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    if (post.status !== "under_review") {
      return res.status(400).json({ success: false, message: "objections can only be raised on posts under review" });
    }

    const role = req.user?.role ?? "guest";
    if (!["senior", "dept_admin", "univ_admin"].includes(role)) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const objectingUser = await userModel.findById(userObjectId).select("name role");

    const objectionEntry = {
      raisedBy: userObjectId,
      reason: reason.trim(),
    };

    post.objections.push(objectionEntry);
    post.status = "objected";
    await post.save();

    await sendObjectionRaisedEmail(post.author, post, objectionEntry, objectingUser);
    await notifyObjectionRaised(post.author, post, objectingUser?.name || "A reviewer");

    return res.status(200).json({ success: true, message: "objection raised successfully", data: post });
  } catch (error) {
    console.error("raiseObjection error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const resolveObjection = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    const userRole = req.user?.role || "guest";
    
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const post = await postModel.findById(req.params.id).populate("author", "name emailId role");

    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    if (post.status !== "objected") {
      return res
        .status(400)
        .json({ success: false, message: "no pending objections for this post" });
    }

    const { objectionId } = req.body;

    if (objectionId) {
      const objection = post.objections.id(objectionId);
      if (!objection) {
        return res
          .status(404)
          .json({ success: false, message: "objection not found" });
      }
      
      // Check authorization - only dept_admin, univ_admin, or objection author can resolve
      const isPrivileged = ["dept_admin", "univ_admin"].includes(userRole);
      const isObjectionAuthor = objection.raisedBy?.toString() === userObjectId.toString();
      
      if (!isPrivileged && !isObjectionAuthor) {
        return res.status(403).json({ 
          success: false, 
          message: "only department admin, university admin, or objection author can resolve objections" 
        });
      }
      
      objection.isResolved = true;
    } else {
      // Resolve all objections - only privileged admins can do this
      const isPrivileged = ["dept_admin", "univ_admin"].includes(userRole);
      
      if (!isPrivileged) {
        return res.status(403).json({ 
          success: false, 
          message: "only department admin or university admin can resolve all objections" 
        });
      }
      
      post.objections.forEach((obj) => {
        if (!obj.isResolved) {
          obj.isResolved = true;
        }
      });
    }

    const hasUnresolved = post.objections.some((obj) => !obj.isResolved);

    let resolutionStatus = null;
    if (!hasUnresolved) {
      const isExpired = new Date(post.reviewExpiresAt) <= new Date();
      post.status = isExpired ? "official" : "under_review";
      resolutionStatus = isExpired ? "approved" : "under_review";
    }

    await post.save();

    if (resolutionStatus) {
      await sendObjectionResolvedEmail(post.author, post, resolutionStatus);
      const isApproved = resolutionStatus === "approved";
      await notifyObjectionResolved(post.author, post, isApproved);
    }

    return res.status(200).json({
      success: true,
      message: "objection(s) resolved successfully",
      data: post,
    });
  } catch (error) {
    console.error("resolveObjection error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const { objectionReplyModel } = require("../models/objectionReply");

const addObjectionReply = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    const userRole = req.user?.role || "guest";
    
    if (!userObjectId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const { id: postId, objectionId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: "reply content required" });
    }

    const post = await postModel.findById(postId).populate("author");
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    const objection = post.objections.id(objectionId);
    if (!objection) {
      return res.status(404).json({ success: false, message: "objection not found" });
    }

    if (objection.isResolved) {
      return res.status(403).json({ success: false, message: "cannot reply to a resolved objection" });
    }

    // Check who can reply: only senior_dept_admin and univ_admin
    const isPrivileged = ["senior_dept_admin", "univ_admin"].includes(userRole);

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "only senior department admin or university admin can reply to objections"
      });
    }
    const reply = new objectionReplyModel({
      objectionId,
      postId,
      author: userObjectId,
      content: content.trim()
    });

    await reply.save();
    await reply.populate("author", "name role designation");

    return res.status(201).json({
      success: true,
      message: "reply added successfully",
      data: reply
    });
  } catch (error) {
    console.error("addObjectionReply error: ", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
};

const getObjectionReplies = async (req, res) => {
  try {
    const { id: postId, objectionId } = req.params;

    const post = await postModel.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, message: "post not found" });
    }

    const objection = post.objections.id(objectionId);
    if (!objection) {
      return res.status(404).json({ success: false, message: "objection not found" });
    }

    const replies = await objectionReplyModel
      .find({ objectionId, postId })
      .populate("author", "name role designation")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: replies
    });
  } catch (error) {
    console.error("getObjectionReplies error: ", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
};

module.exports = {
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
};
