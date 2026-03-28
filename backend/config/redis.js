const redis = require("redis");
const {RedisStore} =require('rate-limit-redis')
require("dotenv").config()

const makeStore = (prefix) => {
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix,
  });
}

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

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("connected to redis");
  }
};

module.exports = { redisClient, connectRedis, makeStore };
