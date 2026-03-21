const express = require("express");
const cors = require("cors");

require("dotenv").config();

const { main } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { userModel } = require("./models/user");
const { authRouter } = require("./routes/authRouter");

PORT = process.env.BACKEND_PORT || 8080;

const app = express();

app.use(express.json());
app.use(cors());

app.use("/auth", authRouter);

const startServer = async () => {
  try {
    await main();
    console.log("connected to database");

    await connectRedis();

    app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("startup failed:", err.message);
    process.exit(1);
  }
};

startServer();
