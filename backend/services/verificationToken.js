const crypto = require("crypto");
const { redisClient } = require("../config/redis");

const TOKEN_BYTES = 32;
const TTL_SECONDS = 10 * 60;
const REDIS_PREFIX = "signup:token:";

const generateToken = () => {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

const storeToken = async (tokenHash, payload) => {
  const key = REDIS_PREFIX + tokenHash;
  await redisClient.set(key, JSON.stringify(payload), { EX: TTL_SECONDS });
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

module.exports = { generateToken, storeToken, verfiyAndDeleteToken };
