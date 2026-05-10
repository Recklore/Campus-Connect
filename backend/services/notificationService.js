const { notificationModel } = require("../models/notification");

const createNotification = async (recipientId, type, title, message, postId, actionUrl) => {
  try {
    const notification = await notificationModel.create({
      recipient: recipientId,
      type,
      title,
      message,
      postId: postId || null,
      actionUrl: actionUrl || null,
    });

    console.log(`[Notification] Created ${type} for user ${recipientId}`);
    return notification;
  } catch (error) {
    console.error("[Notification] Error creating notification:", error.message);
    return null;
  }
};


const notifyPostApproved = async (author, post) => {
  if (!author?._id) return;

  const actionUrl = `/app/posts/${post._id}`;
  await createNotification(
    author._id,
    "POST_APPROVED",
    "Post Approved!",
    `Your post "${post.title}" has been approved and is now visible to all users.`,
    post._id,
    actionUrl,
  );
};

const notifyPostRejected = async (author, post) => {
  if (!author?._id) return;

  const actionUrl = `/app/posts/${post._id}`;
  await createNotification(
    author._id,
    "POST_REJECTED",
    "Post Rejected",
    `Your post "${post.title}" has been rejected. Objections were upheld.`,
    post._id,
    actionUrl,
  );
};


const notifyObjectionRaised = async (author, post, objectingUserName) => {
  if (!author?._id) return;

  const actionUrl = `/app/posts/${post._id}`;
  await createNotification(
    author._id,
    "OBJECTION_RAISED",
    "Objection Raised",
    `${objectingUserName} has raised an objection on your post "${post.title}".`,
    post._id,
    actionUrl,
  );
};


const notifyObjectionResolved = async (author, post, isApproved) => {
  if (!author?._id) return;

  const type = isApproved ? "OBJECTION_RESOLVED" : "POST_REJECTED";
  const title = isApproved ? "Objections Resolved" : "Post Rejected";
  const message = isApproved
    ? `All objections on your post "${post.title}" have been resolved. Your post is now approved.`
    : `The objections on your post "${post.title}" were upheld. Your post has been rejected.`;
  const actionUrl = `/app/posts/${post._id}`;

  await createNotification(author._id, type, title, message, post._id, actionUrl);
};

const notifyDiscussionReply = async (discussionAuthorId, replyAuthorName, discussion) => {
  if (!discussionAuthorId) return;

  const actionUrl = `/app/discussions/${discussion._id}`;
  await createNotification(
    discussionAuthorId,
    "DISCUSSION_REPLY",
    "New Reply",
    `${replyAuthorName} replied to your discussion "${discussion.title}".`,
    null,
    actionUrl,
  );
};

module.exports = {
  createNotification,
  notifyPostApproved,
  notifyPostRejected,
  notifyObjectionRaised,
  notifyObjectionResolved,
  notifyDiscussionReply,
};
