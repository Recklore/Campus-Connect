const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const { main } = require("./config/db");
const { connectRedis } = require("./config/redis");

const PORT = process.env.BACKEND_PORT;
const FRONTEND_ORIGIN = process.env.FRONTEND_BASE_URL;

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

app.get("/health", (req, res) => {
  return res.status(200).json({ success: true, message: "ok" });
});

const startServer = async () => {
  try {
    await main();
    console.log("connected to database");

    await connectRedis();

    const { authRouter } = require("./routes/authRouter");
    const { deptRouter } = require("./routes/deptRouter");
    const { postRouter } = require("./routes/postRouter");
    app.use("/auth", authRouter);
    app.use("/departments", deptRouter);
    app.use("/posts", postRouter);

    app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("startup failed:", err.message);
    process.exit(1);
  }
};

startServer();
