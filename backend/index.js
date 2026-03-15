const express = require("express");
const cors = require("cors");

require("dotenv").config();

const { main } = require("./models/db");
const { userModel } = require("./models/user");
const { authRouter } = require("./routes/authRouter");

PORT = process.env.PORT || 8080;

const app = express();

app.use(express.json());
app.use(cors());

app.use("/auth", authRouter);

app.listen(PORT, async () => {
  await main();
  console.log("connected to database");
  console.log(`server is running on port ${PORT}`);
});
