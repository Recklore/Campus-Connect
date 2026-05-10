const mongoose = require("mongoose");
const { postModel } = require("../models/post");
require("dotenv").config();
const { main: connectDB } = require("../config/db");

const autoApprovePosts = async () => {
  console.log("Running auto-approval task...");
  try {
    await connectDB();
    const now = new Date();

    const query = {
      status: "under_review",
      reviewExpiresAt: { $lte: now },
      "objections.isResolved": { $ne: false }, // All objections are resolved or no objections
      "objections": { $not: { $elemMatch: { isResolved: false } } }, // No unresolved objections
    };

    const { modifiedCount } = await postModel.updateMany(
      query,
      { $set: { status: "official", isOfficial: true } },
    );

    console.log(`Auto-approved ${modifiedCount} posts.`);
  } catch (error) {
    console.error("Error during auto-approval task:", error);
  } finally {
    await mongoose.disconnect();
  }
};

autoApprovePosts();
