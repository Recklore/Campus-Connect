const cron = require("node-cron");
const { postModel } = require("../models/post");
const { sendPostApprovedEmail } = require("./mailNotificationService");
const { notifyPostApproved } = require("./notificationService");

let taskSchedule = null;

const executeAutoApproval = async () => {
  try {
    const now = new Date();

    const query = {
      status: "under_review",
      reviewExpiresAt: { $lte: now },
      "objections": { $not: { $elemMatch: { isResolved: false } } },
    };


    const postsToApprove = await postModel
      .find(query)
      .populate("author", "name emailId role");

    const { modifiedCount } = await postModel.updateMany(
      query,
      { $set: { status: "official", isOfficial: true } },
    );

    if (modifiedCount > 0) {
      for (const post of postsToApprove) {
        await sendPostApprovedEmail(post.author, post);
        await notifyPostApproved(post.author, post);
      }
      console.log(`[Auto-Approval] ✓ Auto-approved ${modifiedCount} post(s) at ${now.toISOString()}`);
    }
  } catch (error) {
    console.error(`[Auto-Approval] ✗ Error during auto-approval task:`, error.message);
  }
};


const startAutoApprovalTask = () => {
  if (taskSchedule) {
    console.warn("[Auto-Approval] Task is already running");
    return;
  }

  taskSchedule = cron.schedule("0 * * * *", executeAutoApproval);
  console.log("Auto-approval task started");
};

const stopAutoApprovalTask = () => {
  if (taskSchedule) {
    taskSchedule.stop();
    taskSchedule = null;
    console.log("Auto-approval task stopped");
  }
};

module.exports = {
  executeAutoApproval,
  startAutoApprovalTask,
  stopAutoApprovalTask,
};
