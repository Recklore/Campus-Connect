const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const postJson = async (path, payload) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return { status: response.status, data };
};

export const authApi = {
  login: (payload) => postJson("/auth/login", payload),
  guestLogin: () => postJson("/auth/guestLogin", {}),
  signup: (payload) => postJson("/auth/signup", payload),
  signupResend: (payload) => postJson("/auth/verify/resend", payload),
  signupVerify: (token) => postJson(`/auth/verify/${encodeURIComponent(token)}`, {}),
  forgotPasswordInit: (payload) => postJson("/auth/forgotPass/init", payload),
  forgotPasswordVerify: (token, payload) =>
    postJson(`/auth/forgotPass/verify/${encodeURIComponent(token)}`, payload),
};
