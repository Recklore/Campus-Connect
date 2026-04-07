const rateLimit = require("express-rate-limit");
const { makeStore } = require("../config/redis");
const { getClientKey } = require("../middleware/getClientKey");

const blockTime = 15 * 60 * 1000;
const ipKey = (req) => rateLimit.ipKeyGenerator(req.ip);

const authLimiter = rateLimit({
  windowMs: blockTime,
  max: 200,
  keyGenerator: (req) => `auth:${req.user?.userId ?? ipKey(req)}`,
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
        : `login:ip:${ipKey(req)}`;
    }

    if (role === "senior") {
      const emailId = req.body?.emailId?.toLowerCase().trim();
      return emailId ? `login:email:${emailId}` : `login:ip:${ipKey(req)}`;
    }

    return `login:ip:${ipKey(req)}`;
  },
  store: makeStore("rl:login:"),
  message: {
    success: false,
    message: "Too many login attempts for this account.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: blockTime,
  max: 10,
  keyGenerator: (req) => {
    const role = req.body?.role;

    if (role === "student") {
      const enrollment = req.body?.enrollmentNumber?.toUpperCase().trim();
      return enrollment
        ? `signup:enrollment:${enrollment}`
        : `signup:ip:${ipKey(req)}`;
    }

    if (role === "senior") {
      const emailId = req.body?.emailId?.toLowerCase().trim();
      return emailId ? `signup:email:${emailId}` : `signup:ip:${ipKey(req)}`;
    }

    return `signup:ip:${ipKey(req)}`;
  },
  store: makeStore("rl:signup:"),
  message: {
    success: false,
    message: "Too many signup attempts for this account.",
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
  keyGenerator: (req) => `ip-ceiling:${ipKey(req)}`,
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
