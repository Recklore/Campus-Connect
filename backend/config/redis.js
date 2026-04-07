const redis = require("redis");
const { RedisStore } = require("rate-limit-redis");
require("dotenv").config();

const redisClient = redis.createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

redisClient.on("error", (err) => {
  console.error("Redis client error:", err.message);
});

let connectPromise = null;

const connectRedis = async () => {
  if (redisClient.isOpen) {
    return;
  }

  if (!connectPromise) {
    connectPromise = redisClient
      .connect()
      .then(() => {
        console.log("connected to redis");
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  await connectPromise;
};

const makeStore = (prefix) => {
  return new RedisStore({
    sendCommand: async (...args) => {
      await connectRedis();
      return redisClient.sendCommand(args);
    },
    prefix,
  });
};

module.exports = { redisClient, connectRedis, makeStore };
