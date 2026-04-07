const crypto = require("crypto");
const { redisClient } = require("../config/redis");

const TOKEN_BYTES = 32;
const TTL_SECONDS = 10 * 60;
const REDIS_PREFIX = "signup:token:";
const SIGNUP_PENDING_EMAIL_PREFIX = "signup:pending:email:";

const generateToken = () => {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

const storeToken = async (tokenHash, payload) => {
  const key = REDIS_PREFIX + tokenHash;
  await redisClient.set(key, JSON.stringify(payload), { EX: TTL_SECONDS });
};

const getSignupPendingKey = (emailId) =>
  SIGNUP_PENDING_EMAIL_PREFIX + emailId.toLowerCase();

const storeSignupPendingToken = async ({
  emailId,
  tokenHash,
  rawToken,
  payload,
}) => {
  const tokenKey = REDIS_PREFIX + tokenHash;
  const pendingKey = getSignupPendingKey(emailId);
  const payloadWithRawToken = { ...payload, rawToken };

  await redisClient
    .multi()
    .set(tokenKey, JSON.stringify(payloadWithRawToken), { EX: TTL_SECONDS })
    .set(pendingKey, tokenHash, { EX: TTL_SECONDS })
    .exec();
};

const getSignupPendingByEmail = async (emailId) => {
  const pendingKey = getSignupPendingKey(emailId);
  const tokenHash = await redisClient.get(pendingKey);

  if (!tokenHash) {
    return null;
  }

  const tokenKey = REDIS_PREFIX + tokenHash;
  const payload = await redisClient.get(tokenKey);

  if (!payload) {
    await redisClient.del(pendingKey);
    return null;
  }

  const parsedPayload = typeof payload === "string" ? JSON.parse(payload) : payload;

  return {
    tokenHash,
    payload: parsedPayload,
  };
};

const refreshSignupPendingTtl = async (emailId, tokenHash) => {
  const pendingKey = getSignupPendingKey(emailId);
  const tokenKey = REDIS_PREFIX + tokenHash;

  await redisClient.multi().expire(tokenKey, TTL_SECONDS).expire(pendingKey, TTL_SECONDS).exec();
};

const verfiyAndDeleteToken = async (token) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = REDIS_PREFIX + tokenHash;
  const userPayload = await redisClient.get(key);

  if (userPayload) {
    await redisClient.del(key);
  }

  return userPayload;
};

module.exports = {
  generateToken,
  storeToken,
  storeSignupPendingToken,
  getSignupPendingByEmail,
  refreshSignupPendingTtl,
  verfiyAndDeleteToken,
};
