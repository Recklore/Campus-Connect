const cron = require('node-cron');
const { commentModel } = require('../models/comment');
const DiscussionReply = require('../models/discussionReply');
const { analyzeText } = require('./toxicityScanner');
const { createNotification } = require('./notificationService');
const { sendContentFlaggedEmail } = require('./mailNotificationService');
const { auditLogModel } = require('../models/auditLog');

let taskSchedule = null;

const SCAN_DAYS = parseInt(process.env.MODERATION_SCAN_DAYS || '7', 10);
const BATCH_SIZE = parseInt(process.env.MODERATION_BATCH_SIZE || '200', 10);

const scanOnce = async () => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - SCAN_DAYS * 24 * 60 * 60 * 1000);

    console.log('Starting moderation scan for recent content since', since.toISOString());

    const comments = await commentModel.find({ moderationStatus: 'visible', isDeleted: false, createdAt: { $gte: since } }).limit(BATCH_SIZE).lean();
    for (const c of comments) {
      try {
        const analysis = await analyzeText(c.body);
        if (analysis && analysis.isToxic) {
          await commentModel.updateOne({ _id: c._id }, {
            $set: {
              moderationStatus: 'flagged',
              isToxic: true,
              toxicityScore: analysis.score || 0,
              flaggedAt: new Date(),
              flagReason: 'automated_daily_scan',
            },
          });

          try {
            await createNotification(c.author, 'CONTENT_FLAGGED', 'Your comment was flagged for review', 'Your comment was temporarily hidden and sent for admin review.', c.post, `/app/posts/${c.post}`);
            const author = await require('../models/user').userModel.findById(c.author).select('emailId name').lean();
            await sendContentFlaggedEmail(author, { contentSnippet: String(c.body).slice(0, 300), contentType: 'comment', score: analysis.score, itemUrl: `/app/posts/${c.post}` });
          } catch (notifyErr) {
            console.error('notify author error:', notifyErr.message);
          }

          try {
            await auditLogModel.create({ actorId: c.author, actorRole: 'guest', actionType: 'UPDATE', targetType: 'Comment', targetId: c._id, ipAddress: 'system', meta: { moderation: 'flagged', score: analysis.score } });
          } catch (aerr) {
            console.error('audit error:', aerr.message);
          }
        }
      } catch (err) {
        console.error('error analyzing comment', c._id, err.message);
      }
    }

    const replies = await DiscussionReply.find({ moderationStatus: 'visible', isDeleted: false, createdAt: { $gte: since } }).limit(BATCH_SIZE).lean();
    for (const r of replies) {
      try {
        const analysis = await analyzeText(r.body);
        if (analysis && analysis.isToxic) {
          await DiscussionReply.updateOne({ _id: r._id }, {
            $set: {
              moderationStatus: 'flagged',
              isToxic: true,
              toxicityScore: analysis.score || 0,
              flaggedAt: new Date(),
              flagReason: 'automated_daily_scan',
            },
          });

          try {
            await createNotification(r.author, 'CONTENT_FLAGGED', 'Your discussion reply was flagged for review', 'Your reply was temporarily hidden and sent for admin review.', null, `/app/discussions/${r.discussion}`);
            const author = await require('../models/user').userModel.findById(r.author).select('emailId name').lean();
            await sendContentFlaggedEmail(author, { contentSnippet: String(r.body).slice(0, 300), contentType: 'discussion reply', score: analysis.score, itemUrl: `/app/discussions/${r.discussion}` });
          } catch (notifyErr) {
            console.error('notify author error:', notifyErr.message);
          }

          try {
            await auditLogModel.create({ actorId: r.author, actorRole: 'guest', actionType: 'UPDATE', targetType: 'DiscussionReply', targetId: r._id, ipAddress: 'system', meta: { moderation: 'flagged', score: analysis.score } });
          } catch (aerr) {
            console.error('audit error:', aerr.message);
          }
        }
      } catch (err) {
        console.error('error analyzing reply', r._id, err.message);
      }
    }

    console.log('Scan completed');
  } catch (err) {
    console.error('scanOnce failed:', err.message);
  }
};

const startModerationTask = () => {
  if (taskSchedule) {
    console.warn('[Task already running');
    return;
  }


  taskSchedule = cron.schedule('0 1 * * *', scanOnce);
  console.log('Moderation task started');
};

const stopModerationTask = () => {
  if (taskSchedule) {
    taskSchedule.stop();
    taskSchedule = null;
    console.log('Moderation task stopped');
  }
};

module.exports = {
  scanOnce,
  startModerationTask,
  stopModerationTask,
};
