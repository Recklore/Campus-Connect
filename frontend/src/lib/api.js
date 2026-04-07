import { getClientKey } from "./clientKey";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const requestJson = async ({ method, path, payload, withFingerprint = true }) => {
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

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return { status: response.status, data };
};

const postJson = (path, payload, withFingerprint = true) =>
  requestJson({ method: "POST", path, payload, withFingerprint });

const getJson = (path, withFingerprint = false) =>
  requestJson({ method: "GET", path, withFingerprint });

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
  getSubscriptions: () => getJson("/departments/subscriptions"),
  toggleSubscription: (departmentId) =>
    getJson(`/departments/${encodeURIComponent(departmentId)}/subscribe`),
};

export const publicApi = {
  getLandingPreview: () => getJson("/posts/public/preview", false),
};

export const postApi = {
  getFeed: ({ scope, cursor } = {}) => getJson(buildFeedPath({ scope, cursor })),
};
