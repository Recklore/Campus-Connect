const { sendVerificationMail } = require("../config/mail");
const {
  renderEmailLayout,
  postDeletedByAdminTemplate,
  discussionDeletedByAdminTemplate,
} = require("../tamplates/mailTemplates");

/**
 * Send email when a post is auto-approved after 24 hours
 */
const sendPostApprovedEmail = async (author, post) => {
  try {
    if (!author?.emailId) {
      console.warn("[Mail] Author email not found for post approval notification");
      return;
    }

    const postUrl = `${process.env.FRONTEND_BASE_URL}/app/posts/${post._id}`;

    const content = `
      <p>
        Your post "<strong>${escapeHtml(post.title)}</strong>" has been <strong style="color:#22c55e;">approved</strong> 
        and is now visible to all users!
      </p>
      <p style="font-size:14px;color:#666;">
        After 24 hours of review with no objections, your post has been automatically approved and published.
      </p>
    `;

    const html = renderEmailLayout({
      title: "Post Approved! 🎉",
      intro: "Great news! Your post has been approved and published.",
      content,
      ctaLabel: "View Post",
      ctaUrl: postUrl,
    });

    sendVerificationMail(author.emailId, {
      subject: `Your Post "${post.title}" Has Been Approved`,
      html,
    });

    console.log(`[Mail] Post approval email sent to ${author.emailId}`);
  } catch (error) {
    console.error("[Mail] Error sending post approval email:", error.message);
  }
};

/**
 * Send email when an objection is raised on a post
 */
const sendObjectionRaisedEmail = async (author, post, objection, objectingUser) => {
  try {
    if (!author?.emailId) {
      console.warn("[Mail] Author email not found for objection notification");
      return;
    }

    const postUrl = `${process.env.FRONTEND_BASE_URL}/app/posts/${post._id}`;
    const raisedByName = objectingUser?.name || "A reviewer";

    const content = `
      <p>
        An objection has been raised on your post "<strong>${escapeHtml(post.title)}</strong>" by <strong>${escapeHtml(raisedByName)}</strong>.
      </p>
      <p style="font-size:14px;color:#666;">
        <strong>Reason:</strong> ${escapeHtml(objection.reason)}
      </p>
      <p style="font-size:14px;color:#666;">
        Your post is now under review. Department admins will evaluate the objection and make a decision.
      </p>
    `;

    const html = renderEmailLayout({
      title: "Objection Raised on Your Post ⚠️",
      intro: "An objection has been raised on one of your posts.",
      content,
      ctaLabel: "View Post",
      ctaUrl: postUrl,
    });

    sendVerificationMail(author.emailId, {
      subject: `Objection Raised: "${post.title}"`,
      html,
    });

    console.log(`[Mail] Objection raised email sent to ${author.emailId}`);
  } catch (error) {
    console.error("[Mail] Error sending objection raised email:", error.message);
  }
};

/**
 * Send email when objections on a post are resolved
 */
const sendObjectionResolvedEmail = async (author, post, resolutionStatus) => {
  try {
    if (!author?.emailId) {
      console.warn("[Mail] Author email not found for objection resolution notification");
      return;
    }

    const postUrl = `${process.env.FRONTEND_BASE_URL}/app/posts/${post._id}`;

    const isApproved = resolutionStatus === "approved";
    const statusColor = isApproved ? "#22c55e" : "#ef4444";
    const statusText = isApproved ? "APPROVED" : "REJECTED";

    const content = `
      <p>
        The objections on your post "<strong>${escapeHtml(post.title)}</strong>" have been reviewed.
      </p>
      <p style="font-size:14px;color:#666;">
        <strong>Status:</strong> <span style="color:${statusColor};font-weight:bold;">${statusText}</span>
      </p>
      <p style="font-size:14px;color:#666;">
        ${
          isApproved
            ? "All objections have been resolved and your post is now approved."
            : "The objections were upheld. Your post has been rejected and is not visible to other users."
        }
      </p>
    `;

    const html = renderEmailLayout({
      title: isApproved ? "Post Approved! 🎉" : "Post Rejected ❌",
      intro: "The objections on your post have been reviewed.",
      content,
      ctaLabel: "View Post",
      ctaUrl: postUrl,
    });

    sendVerificationMail(author.emailId, {
      subject: `Your Post "${post.title}" Has Been ${statusText}`,
      html,
    });

    console.log(`[Mail] Objection resolution email sent to ${author.emailId}`);
  } catch (error) {
    console.error("[Mail] Error sending objection resolution email:", error.message);
  }
};

const sendPostDeletedByAdminEmail = async (author, post, adminUser) => {
  try {
    if (!author?.emailId) {
      return;
    }

    const mailData = postDeletedByAdminTemplate({
      authorName: author.name,
      postTitle: post?.title,
      adminName: adminUser?.name || "Administrator",
    });

    sendVerificationMail(author.emailId, mailData);
  } catch (error) {
    console.error("[Mail] Error sending post deletion email:", error.message);
  }
};

const sendDiscussionDeletedByAdminEmail = async (author, discussion, adminUser) => {
  try {
    if (!author?.emailId) {
      return;
    }

    const mailData = discussionDeletedByAdminTemplate({
      authorName: author.name,
      discussionTitle: discussion?.title,
      adminName: adminUser?.name || "Administrator",
    });

    sendVerificationMail(author.emailId, mailData);
  } catch (error) {
    console.error("[Mail] Error sending discussion deletion email:", error.message);
  }
};

/**
 * Helper to escape HTML characters
 */
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = {
  sendPostApprovedEmail,
  sendObjectionRaisedEmail,
  sendObjectionResolvedEmail,
  sendPostDeletedByAdminEmail,
  sendDiscussionDeletedByAdminEmail,
  sendContentFlaggedEmail,
};

/**
 * Send email to author when their content (comment / discussion reply) is flagged by automated moderation
 */
async function sendContentFlaggedEmail(author, opts = {}) {
  try {
    if (!author?.emailId) {
      console.warn('[Mail] Author email not found for flagged content notification');
      return;
    }

    const { contentSnippet = '', contentType = 'content', score = null, itemUrl = '#' } = opts;

    const content = `
      <p>
        Your ${escapeHtml(contentType)} was flagged by our automated moderation system as potentially violating community guidelines.
      </p>
      <p style="font-size:14px;color:#666;">
        <strong>Excerpt:</strong> ${escapeHtml(contentSnippet)}
      </p>
      <p style="font-size:14px;color:#666;">
        <strong>Score:</strong> ${score !== null ? String(score) : 'N/A'}
      </p>
      <p style="font-size:14px;color:#666;">
        The content has been hidden from other users while an admin reviews it. If this was a mistake, you can reply to this email to request a review.
      </p>
    `;

    const html = renderEmailLayout({
      title: 'Content Flagged for Review ⚠️',
      intro: 'Your content has been flagged by our moderation system.',
      content,
      ctaLabel: 'View Item',
      ctaUrl: `${process.env.FRONTEND_BASE_URL}${itemUrl}`,
    });

    sendVerificationMail(author.emailId, {
      subject: 'Your content has been flagged for review',
      html,
    });

    console.log(`[Mail] Content flagged email sent to ${author.emailId}`);
  } catch (error) {
    console.error('[Mail] Error sending flagged content email:', error.message);
  }
}
