const { postModel } = require("../models/post");
const { departmentModel } = require("../models/department");
const { subscriptionModel } = require("../models/subscription");

const crypto = require("crypto");

const computeChecksum = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const FEATURED_POST_LIMIT = 5;
const FEATURED_DEPARTMENT_LIMIT = 5;
const FEED_PAGE_SIZE = 20;

const FEED_SCOPES = {
  GENERAL: "general",
  PERSONAL: "personal",
};

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

const getPersonalFeedResult = async (userId, cursorDate) => {
  const subscriptions = await subscriptionModel
    .find({ user: userId })
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

const createPost = async (req, res) => {
  try {
    const { title, body, departmentId } = req.body;

    const department = await departmentModel.findById(departmentId);
    if (!department || !department.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "department not found" });
    }

    const attachment = (req.files || []).map((file) => ({
      originalName: file.originalname,
      storedName: `${crypto.randomUUID()}-${file.originalname}`,
      mimeType: file.mimetype,
      size: file.size,
      checksum: computeChecksum(file.buffer),
    }));

    const reviewExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const post = await postModel.create({
      title,
      body,
      department: departmentId,
      author: req.user._id,
      attachment,
      reviewExpiresAt: reviewExpireAt,
    });

    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    console.error("createPost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .where("isDeleted")
      .equal(false)
      .populate("author", "role enrollmentNumber emailId")
      .populate("department", "deptName deptCode");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "post not found" });
    }

    const role = req.user?.role ?? "guest";
    const userId = req.user?._id ?? null;

    if (post.status === "under_review") {
      const isAuthor = String(post.author?._id) === String(userId);
      const isAdmin = ["dept_admin", "univ_admin"].includes(role);

      if (!isAuthor && !isAdmin) {
        return res
          .status(404)
          .json({ success: false, message: "post not found" });
      }
    }

    if (post.status === "objected" || post.status === "rejected") {
      const canSee = ["dept_admin", "univ_admin"].includes(role);

      if (!canSee) {
        return res
          .status(404)
          .json({ success: false, message: "post not found" });
      }
    }

    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    console.error("getPost error: ", error);
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

    const feedResult =
      resolvedScope === FEED_SCOPES.PERSONAL
        ? await getPersonalFeedResult(req.user._id, cursorDate)
        : await getGeneralFeedResult(cursorDate);

    const payload = {
      success: true,
      data: feedResult.posts,
      nextCursor: feedResult.nextCursor,
      feedScope: resolvedScope,
      canSwitchScope,
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

    return res.status(200).json({ success: true, data: posts, nextCursor });
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

const deletePost = async (req, res) => {
  try {
    const post = await postModel
      .findById(req.params.id)
      .where("isDeleted")
      .equals(false);

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

    return res.status(200).json({ success: true, message: "post deleted" });
  } catch (error) {
    console.error("deletePost error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

module.exports = {
  createPost,
  getPost,
  getFeed,
  getDepartmentPosts,
  getPublicPreview,
  deletePost,
};
