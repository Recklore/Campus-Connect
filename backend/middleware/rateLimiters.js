const reteLimit = require("express-rate-limit");
const { makeStore } = require("../config/redis");
const { getClientKey } = require("../middleware/getClientKey");

const blockTime = 15 * 60 * 1000;

const authLimiter = rateLimit({
  windowMs: blockTime,
  max: 200,
  keyGenerator: (req) => `auth:${req.user.id}`,
  store: makeStore("rl:auth:"),
  message: { success: false, message: "Too many requests, slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: blockTime,
  max: 10,
  keyGenerator: (req) => {
    const role = req.body?.role;

    if (role === "student") {
      const enrollment = req.body?.enrollmentNumber?.toUpperCase().trim();
      return enrollment
        ? `login:enrollment:${enrollment}`
        : `login:ip:${req.ip}`;
    }

    if (role === "senior") {
      const emailId = req.body?.emailId?.toLowerCase().trim();
      return emailId ? `login:email:${emailId}` : `login:ip:${req.ip}`;
    }

    return `login:ip:${req.ip}`;
  },
  store: makeStore("rl:login:"),
  message: {
    success: false,
    message: "Too many login attempts for this account.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const guestLimiter = rateLimit({
  windowMs: blockTime,
  max: 150,
  keyGenerator: (req) => getClientKey(req, "guest"),
  store: makeStore("rl:guest:"),
  message: { success: false, message: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

const ipCeilingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  skip: (req) => req.ip === process.env.UNIVERSITY_PUBLIC_IP,
  keyGenerator: (req) => `ip-ceiling:${req.ip}`,
  store: makeStore("rl:ip-ceiling:"),
  message: { success: false, message: "Too many requests from this network." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  loginLimiter,
  signupLimiter,
  guestLimiter,
  ipCeilingLimiter,
};
