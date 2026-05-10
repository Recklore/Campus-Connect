const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const { main } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { initSocketIO } = require("./config/socketio");
const { auditLogger } = require("./middleware/auditLogger");
const {
  startAutoApprovalTask,
  stopAutoApprovalTask,
} = require("./services/postApprovalService");

const PORT = process.env.BACKEND_PORT;
const FRONTEND_ORIGIN = process.env.FRONTEND_BASE_URL;

const app = express();

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", parseInt(process.env.TRUST_PROXY, 10) || 1);
}

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(auditLogger);

app.get("/health", (req, res) => {
  return res.status(200).json({ success: true, message: "ok" });
});

const startServer = async () => {
  try {
    await main();
    console.log("connected to database");

    await connectRedis();
    console.log("connected to redis");


    startAutoApprovalTask();

      const { startModerationTask, stopModerationTask } = require("./services/moderationService");
      startModerationTask();

    const { authRouter } = require("./routes/authRouter");
    const { deptRouter } = require("./routes/deptRouter");
    const { postRouter } = require("./routes/postRouter");
    const { userRouter } = require("./routes/userRouter");
    const { adminRouter } = require("./routes/adminRouter");
    const { notificationRouter } = require("./routes/notificationRouter");
    const { discussionRouter } = require("./routes/discussionRouter");

    app.use("/auth", authRouter);
    app.use("/departments", deptRouter);
    app.use("/posts", postRouter);
    app.use("/users", userRouter);
    app.use("/admin", adminRouter);
    app.use("/notifications", notificationRouter);
    app.use("/discussions", discussionRouter);

    const server = app.listen(PORT, () => {
      console.log(`server is running on port ${PORT}`);
    });

  
    const io = initSocketIO(server);


    app.use((req, res, next) => {
      req.io = io;
      next();
    });

    process.on("SIGTERM", () => {
      console.log("SIGTERM signal received: closing HTTP server");
      stopAutoApprovalTask();
      stopModerationTask();
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("SIGINT signal received: closing HTTP server");
      stopAutoApprovalTask();
      stopModerationTask();
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("startup failed:", err);
    process.exit(1);
  }
};

startServer();
