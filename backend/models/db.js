const mongoose = require("mongoose");
require("dotenv").config();

mongo_conn_url = process.env.MONGO_CONN_URL;

async function main() {
  await mongoose.connect(mongo_conn_url);
  console.log("connecting to database");
}

module.exports = { main };
