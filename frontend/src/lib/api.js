import { getClientKey } from "./clientKey";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeToRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = () => {
  refreshSubscribers.forEach(callback => callback());
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  if (isRefreshing) {
    return new Promise(resolve => {
      subscribeToRefresh(() => resolve());
    });
  }

  isRefreshing = true;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    onRefreshed();
    isRefreshing = false;
  } catch (err) {
    isRefreshing = false;
    // Redirect to login if refresh fails
    window.location.href = "/auth/login";
    throw err;
  }
};

const requestJson = async ({ method, path, payload, withFingerprint = true }, retryCount = 0) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (withFingerprint) {
    const fp = await getClientKey();
    headers["x-device-fingerprint"] = fp;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401 && retryCount === 0) {
    try {
      await refreshAccessToken();
      // Retry the original request with refreshed token
      return requestJson({ method, path, payload, withFingerprint }, retryCount + 1);
    } catch (err) {
      const error = new Error(data.message || "Authentication failed");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { status: response.status, data };
};

const requestForm = async ({ method, path, formData, withFingerprint = true }, retryCount = 0) => {
  const headers = {};

  if (withFingerprint) {
    const fp = await getClientKey();
    headers["x-device-fingerprint"] = fp;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: formData,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  // Handle 401 Unauthorized - attempt token refresh
  if (response.status === 401 && retryCount === 0) {
    try {
      await refreshAccessToken();
      // Retry the original request with refreshed token
      return requestForm({ method, path, formData, withFingerprint }, retryCount + 1);
    } catch (err) {
      const error = new Error(data.message || "Authentication failed");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { status: response.status, data };
};

const requestBlob = async ({ method, path, withFingerprint = true }, retryCount = 0) => {
  const headers = {};

  if (withFingerprint) {
    const fp = await getClientKey();
    headers["x-device-fingerprint"] = fp;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
  });

  let responseData = {};
  if (!response.ok) {
    try {
      responseData = await response.json();
    } catch {
      responseData = {};
    }
  }

  if (response.status === 401 && retryCount === 0) {
    try {
      await refreshAccessToken();
      return requestBlob({ method, path, withFingerprint }, retryCount + 1);
    } catch (err) {
      const error = new Error(responseData.message || "Authentication failed");
      error.status = response.status;
      error.payload = responseData;
      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(responseData.message || "Request failed");
    error.status = response.status;
    error.payload = responseData;
    throw error;
  }

  return { status: response.status, blob: await response.blob(), headers: response.headers };
};

const postJson = (path, payload, withFingerprint = true) =>
  requestJson({ method: "POST", path, payload, withFingerprint });

const getJson = (path, withFingerprint = false) =>
  requestJson({ method: "GET", path, withFingerprint });

const deleteJson = (path, withFingerprint = true) =>
  requestJson({ method: "DELETE", path, withFingerprint });

const postForm = (path, formData, withFingerprint = true) =>
  requestForm({ method: "POST", path, formData, withFingerprint });

const buildFeedPath = ({ scope, cursor } = {}) => {
  const params = new URLSearchParams();

  if (scope) {
    params.set("scope", scope);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  const query = params.toString();
  return query ? `/posts/feed?${query}` : "/posts/feed";
};

const buildCursorPath = (path, cursor) => {
  if (!cursor) {
    return path;
  }

  const params = new URLSearchParams();
  params.set("cursor", cursor);
  return `${path}?${params.toString()}`;
};

const buildAuditLogPath = ({
  limit,
  skip,
  actorId,
  actionType,
  targetType,
  routeKey,
  requestMethod,
  requestId,
  actionSummary,
  hasTargetId,
  minStatus,
  maxStatus,
  createdAfter,
  createdBefore,
} = {}) => {
  const params = new URLSearchParams();

  if (limit) {
    params.set("limit", limit);
  }
  if (skip) {
    params.set("skip", skip);
  }
  if (actorId) {
    params.set("actorId", actorId);
  }
  if (actionType) {
    params.set("actionType", actionType);
  }
  if (targetType) {
    params.set("targetType", targetType);
  }
  if (routeKey) {
    params.set("routeKey", routeKey);
  }
  if (requestMethod) {
    params.set("requestMethod", requestMethod);
  }
  if (requestId) {
    params.set("requestId", requestId);
  }
  if (actionSummary) {
    params.set("actionSummary", actionSummary);
  }
  if (hasTargetId !== "") {
    params.set("hasTargetId", hasTargetId);
  }
  if (minStatus) {
    params.set("minStatus", minStatus);
  }
  if (maxStatus) {
    params.set("maxStatus", maxStatus);
  }
  if (createdAfter) {
    params.set("createdAfter", createdAfter);
  }
  if (createdBefore) {
    params.set("createdBefore", createdBefore);
  }

  const query = params.toString();
  return query ? `/admin/auditlogs?${query}` : "/admin/auditlogs";
};

const buildAuditLogExportPath = ({
  actorId,
  actionType,
  targetType,
  routeKey,
  requestMethod,
  requestId,
  actionSummary,
  hasTargetId,
  minStatus,
  maxStatus,
  createdAfter,
  createdBefore,
} = {}) => {
  const params = new URLSearchParams();

  if (actorId) {
    params.set("actorId", actorId);
  }
  if (actionType) {
    params.set("actionType", actionType);
  }
  if (targetType) {
    params.set("targetType", targetType);
  }
  if (routeKey) {
    params.set("routeKey", routeKey);
  }
  if (requestMethod) {
    params.set("requestMethod", requestMethod);
  }
  if (requestId) {
    params.set("requestId", requestId);
  }
  if (actionSummary) {
    params.set("actionSummary", actionSummary);
  }
  if (hasTargetId !== "") {
    params.set("hasTargetId", hasTargetId);
  }
  if (minStatus) {
    params.set("minStatus", minStatus);
  }
  if (maxStatus) {
    params.set("maxStatus", maxStatus);
  }
  if (createdAfter) {
    params.set("createdAfter", createdAfter);
  }
  if (createdBefore) {
    params.set("createdBefore", createdBefore);
  }

  const query = params.toString();
  return query ? `/admin/auditlogs/export?${query}` : "/admin/auditlogs/export";
};

export const authApi = {
  login: (payload) => postJson("/auth/login", payload),
  guestLogin: () => postJson("/auth/guestLogin", {}),
  logout: () => postJson("/auth/logout", {}, false),
  signup: (payload) => postJson("/auth/signup", payload),
  signupResend: (payload) => postJson("/auth/verify/resend", payload),
  signupVerify: (token) => postJson(`/auth/verify/${encodeURIComponent(token)}`, {}),
  forgotPasswordInit: (payload) => postJson("/auth/forgotPass/init", payload),
  forgotPasswordVerify: (token, payload) =>
    postJson(`/auth/forgotPass/verify/${encodeURIComponent(token)}`, payload),
};

export const departmentApi = {
  getAll: () => getJson("/departments"),
  getById: (departmentId) => getJson(`/departments/${encodeURIComponent(departmentId)}`),
  getSubscriptions: () => getJson("/departments/subscriptions"),
  toggleSubscription: (departmentId, action) => {
    if (action === "subscribe") {
      return postJson(`/departments/${encodeURIComponent(departmentId)}/subscribe`, {});
    } else if (action === "unsubscribe") {
      return deleteJson(`/departments/${encodeURIComponent(departmentId)}/subscribe`);
    }
    throw new Error("Invalid action for toggleSubscription");
  },
};

export const publicApi = {
  getLandingPreview: () => getJson("/posts/public/preview", false),
};

export const postApi = {
  getFeed: ({ scope, cursor } = {}) => getJson(buildFeedPath({ scope, cursor })),
  getPost: (postId) => getJson(`/posts/${encodeURIComponent(postId)}`),
  getMyPosts: ({ cursor } = {}) => getJson(buildCursorPath("/posts/me", cursor)),
  getUserPosts: (userId, { cursor } = {}) =>
    getJson(buildCursorPath(`/posts/user/${encodeURIComponent(userId)}`, cursor)),
  getDepartmentPosts: ({ departmentId, cursor } = {}) =>
    getJson(
      buildCursorPath(`/posts/department/${encodeURIComponent(departmentId)}`, cursor),
    ),
  createPost: ({ title, body, attachments = [] }) => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("body", body);

    attachments.forEach((file) => {
      formData.append("attachments", file);
    });

    return postForm("/posts", formData);
  },
  deletePost: (postId) => deleteJson(`/posts/${encodeURIComponent(postId)}`),
  toggleLike: (postId) => postJson(`/posts/${encodeURIComponent(postId)}/like`, {}),
  getComments: ({ postId, cursor } = {}) =>
    getJson(buildCursorPath(`/posts/${encodeURIComponent(postId)}/comments`, cursor)),
  addComment: (postId, payload) =>
    postJson(`/posts/${encodeURIComponent(postId)}/comments`, payload),
  editComment: (postId, commentId, payload) =>
    requestJson({ method: "PUT", path: `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, payload }),
  deleteComment: (postId, commentId) =>
    deleteJson(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    ),
  markCommentAsOfficial: (postId, commentId) =>
    requestJson({ method: "PUT", path: `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/official` }),
  toggleCommentVisibility: (postId, commentId) =>
    requestJson({ method: "PUT", path: `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/visibility` }),
  raiseObjection: (postId, payload) =>
    postJson(`/posts/${encodeURIComponent(postId)}/object`, payload),
  resolveObjection: (postId, payload) =>
    requestJson({ method: "PUT", path: `/posts/${encodeURIComponent(postId)}/resolveObjection`, payload }),
  getObjectionReplies: (postId, objectionId) =>
    getJson(
      `/posts/${encodeURIComponent(postId)}/objections/${encodeURIComponent(objectionId)}/replies`,
    ),
  addObjectionReply: (postId, objectionId, payload) =>
    postJson(
      `/posts/${encodeURIComponent(postId)}/objections/${encodeURIComponent(objectionId)}/replies`,
      payload,
    ),
};

export const userApi = {
  getMe: () => getJson("/users/me"),
  getUserProfileById: (userId) => getJson(`/users/${encodeURIComponent(userId)}/profile`),
};

const buildSearchPath = ({ q, type = "all", limit = 10, page = 1 } = {}) => {
  const params = new URLSearchParams();
  params.set("q", q || "");
  if (type) params.set("type", type);
  if (limit) params.set("limit", String(limit));
  if (page) params.set("page", String(page));
  return `/users/search?${params.toString()}`;
};

export const searchApi = {
  globalSearch: ({ q, type = "all", limit = 10, page = 1 } = {}) =>
    getJson(buildSearchPath({ q, type, limit, page })),
};

export const adminApi = {
  getStats: () => getJson("/admin/stats"),
  getAuditLogs: (filters = {}) =>
    getJson(buildAuditLogPath(filters)),
  exportAuditLogs: (filters = {}) =>
    requestBlob({ method: "GET", path: buildAuditLogExportPath(filters) }),
  promoteUserRole: (userId, payload) =>
    postJson(`/admin/users/${encodeURIComponent(userId)}/promote`, payload),
  demoteUserRole: (userId, payload) =>
    postJson(`/admin/users/${encodeURIComponent(userId)}/demote`, payload),
  getObjections: ({ limit, skip, status } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit);
    if (skip) params.set("skip", skip);
    if (status) params.set("status", status);
    const query = params.toString();
    const path = query ? `/admin/objections?${query}` : "/admin/objections";
    return getJson(path);
  },
  // Flags API for automated moderation
  getFlags: ({ type, limit, skip } = {}) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (limit) params.set('limit', limit);
    if (skip) params.set('skip', skip);
    const query = params.toString();
    const path = query ? `/admin/flags?${query}` : '/admin/flags';
    return getJson(path);
  },
  approveFlag: (type, id) => postJson(`/admin/flags/${encodeURIComponent(type)}/${encodeURIComponent(id)}/approve`, {}),
  rejectFlag: (type, id, payload) => postJson(`/admin/flags/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reject`, payload || {}),
  restoreFlag: (type, id) => postJson(`/admin/flags/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`, {}),
};

export const notificationApi = {
  getNotifications: ({ limit, skip, isRead } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit);
    if (skip) params.set("skip", skip);
    if (isRead !== undefined) params.set("isRead", isRead);
    const query = params.toString();
    const path = query ? `/notifications?${query}` : "/notifications";
    return getJson(path);
  },
  markAsRead: (notificationId) =>
    requestJson({ method: "PUT", path: `/notifications/${encodeURIComponent(notificationId)}/read` }),
  markAllAsRead: () =>
    requestJson({ method: "PUT", path: "/notifications/read-all" }),
  deleteNotification: (notificationId) =>
    deleteJson(`/notifications/${encodeURIComponent(notificationId)}`),
};

const buildDiscussionPath = ({ visibility, department, sort, limit, cursor } = {}) => {
  const params = new URLSearchParams();
  
  if (visibility) params.set("visibility", visibility);
  if (department) params.set("department", department);
  if (sort) params.set("sort", sort);
  if (limit) params.set("limit", limit);
  if (cursor) params.set("cursor", cursor);
  
  const query = params.toString();
  return query ? `/discussions?${query}` : "/discussions";
};

export const discussionApi = {
  getDiscussions: ({ visibility, department, sort, limit, cursor } = {}) =>
    getJson(buildDiscussionPath({ visibility, department, sort, limit, cursor })),
  
  getDiscussionDetail: ({ id, limit, cursor } = {}) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit);
    if (cursor) params.set("cursor", cursor);
    const query = params.toString();
    const path = query ? `/discussions/${encodeURIComponent(id)}?${query}` : `/discussions/${encodeURIComponent(id)}`;
    return getJson(path);
  },
  
  createDiscussion: (payload) =>
    postJson("/discussions", payload),
  
  editDiscussion: (id, payload) =>
    requestJson({ method: "PUT", path: `/discussions/${encodeURIComponent(id)}`, payload }),
  
  deleteDiscussion: (id) =>
    deleteJson(`/discussions/${encodeURIComponent(id)}`),
  
  addThought: (id, payload) =>
    postJson(`/discussions/${encodeURIComponent(id)}/thoughts`, payload),

  editThought: (id, thoughtId, payload) =>
    requestJson({ method: "PUT", path: `/discussions/${encodeURIComponent(id)}/thoughts/${encodeURIComponent(thoughtId)}`, payload }),

  deleteThought: (id, thoughtId) =>
    deleteJson(`/discussions/${encodeURIComponent(id)}/thoughts/${encodeURIComponent(thoughtId)}`),

  // Backward compatibility
  addReply: (id, payload) =>
    postJson(`/discussions/${encodeURIComponent(id)}/replies`, payload),
  
  editReply: (id, replyId, payload) =>
    requestJson({ method: "PUT", path: `/discussions/${encodeURIComponent(id)}/replies/${encodeURIComponent(replyId)}`, payload }),
  
  deleteReply: (id, replyId) =>
    deleteJson(`/discussions/${encodeURIComponent(id)}/replies/${encodeURIComponent(replyId)}`),
};
