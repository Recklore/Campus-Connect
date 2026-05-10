const Discussion = require('../models/discussion.js');
const DiscussionReply = require('../models/discussionReply.js');
const { userModel } = require('../models/user.js');
const { departmentModel } = require('../models/department.js');
const { sendDiscussionDeletedByAdminEmail } = require('../services/mailNotificationService');
const { analyzeText } = require('../services/toxicityScanner');
const { createNotification } = require('../services/notificationService');
const { sendContentFlaggedEmail } = require('../services/mailNotificationService');
const { auditLogModel } = require('../models/auditLog');


const canModerateDeletion = async (userId, discussion) => {
  const actor = await userModel.findById(userId).select('role department').lean();
  if (!actor) {
    return false;
  }

  const authorId = discussion.author?._id ? discussion.author._id.toString() : discussion.author.toString();
  if (authorId === userId.toString()) {
    return true;
  }

  if (actor.role === 'univ_admin') {
    return true;
  }

  if (actor.role !== 'dept_admin') {
    return false;
  }

  const author = await userModel.findById(authorId).select('department').lean();
  if (!author?.department || !actor.department) {
    return false;
  }

  return String(author.department).trim().toLowerCase() === String(actor.department).trim().toLowerCase();
};

const canCreateDiscussion = (userRole) => {
  const allowedRoles = ['senior', 'dept_admin', 'univ_admin'];
  return allowedRoles.includes(userRole);
};

const canReplyDiscussion = (userRole) => {
  const allowedRoles = ['student', 'senior', 'dept_admin', 'univ_admin'];
  return allowedRoles.includes(userRole);
};


const getDiscussions = async (req, res) => {
  try {
    const { visibility = 'global', department = null, limit = 20, cursor = null, sort = 'latest' } = req.query;
    const pageLimit = Math.min(parseInt(limit), 50);
    
    const query = { isDeleted: false };
    
    if (visibility && visibility !== 'all') {
      query.visibility = visibility;
    }
    
    if (department && department !== 'null') {
      query.department = department;
    }
    
    let sortObj = { createdAt: -1 };
    if (sort === 'pinned') {
      sortObj = { pinnedAt: -1, createdAt: -1 };
    } else if (sort === 'replies') {
      sortObj = { thoughtCount: -1, replyCount: -1, createdAt: -1 };
    }
    

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      query.createdAt = { $lt: new Date(decodedCursor) };
    }
    
    const discussions = await Discussion.find(query)
      .populate('author', 'name role department')
      .populate('department', 'deptName')
      .sort(sortObj)
      .limit(pageLimit + 1);
    
    const hasMore = discussions.length > pageLimit;
    const results = discussions.slice(0, pageLimit);
    
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString('base64');
    }
    
    return res.status(200).json({
      success: true,
      data: results,
      pagination: {
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching discussions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch discussions',
    });
  }
};

const getDiscussionDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, cursor = null } = req.query;
    const pageLimit = Math.min(parseInt(limit), 50);
    
    const discussion = await Discussion.findById(id)
      .populate('author', 'name role department')
      .populate('department', 'deptName');
    
    if (!discussion || discussion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }
    
    const thoughtQuery = { discussion: id, isDeleted: false, moderationStatus: 'visible', parentThought: null };
    
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      thoughtQuery.createdAt = { $lt: new Date(decodedCursor) };
    }
    
    const thoughts = await DiscussionReply.find(thoughtQuery)
      .populate('author', 'name role')
      .sort({ createdAt: -1 })
      .limit(pageLimit + 1);
    
    const hasMore = thoughts.length > pageLimit;
    const thoughtResults = thoughts.slice(0, pageLimit);

    const parentIds = thoughtResults.map((thought) => thought._id);
    const childThoughts = parentIds.length > 0
      ? await DiscussionReply.find({
          discussion: id,
          isDeleted: false,
          moderationStatus: 'visible',
          parentThought: { $ne: null },
        })
          .populate('author', 'name role')
          .sort({ createdAt: 1 })
      : [];

    const childMap = new Map();
    childThoughts.forEach((child) => {
      const parentId = child.parentThought?.toString();
      if (!parentId) return;
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId).push(child);
    });

    const buildNestedThoughts = (parentId) => {
      const children = childMap.get(parentId.toString()) || [];
      return children.map((child) => {
        const obj = child.toObject();
        obj.thoughtReplies = buildNestedThoughts(child._id);
        return obj;
      });
    };

    const shapedThoughts = thoughtResults.map((thought) => {
      const obj = thought.toObject();
      obj.thoughtReplies = buildNestedThoughts(thought._id);
      return obj;
    });
    
    let nextCursor = null;
    if (hasMore && thoughtResults.length > 0) {
      const lastItem = thoughtResults[thoughtResults.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString('base64');
    }
    
    return res.status(200).json({
      success: true,
      data: {
        discussion,
        thoughts: shapedThoughts,
        pagination: {
          nextCursor,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching discussion detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch discussion',
    });
  }
};

// Create discussion
const createDiscussion = async (req, res) => {
  try {
    const { title, description, body, visibility, department } = req.body;
    const authorId = req.user._id;
    
    // Check user permission
    if (!canCreateDiscussion(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only senior users and above can create discussions',
      });
    }
    
    // If department-scoped, validate department exists
    if (visibility === 'department' && department) {
      const dept = await departmentModel.findById(department);
      if (!dept) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department',
        });
      }
    }
    
    const newDiscussion = new Discussion({
      title,
      description,
      body,
      author: authorId,
      visibility: visibility || 'global',
      department: visibility === 'department' ? department : null,
    });
    
    await newDiscussion.save();
    await newDiscussion.populate('author', 'name role');
    
    // Emit socket event for real-time update
    if (req.io) {
      const room = visibility === 'department' ? `dept:${department}` : 'discussions:global';
      req.io.to(room).emit('discussion:created', newDiscussion);
    }
    
    return res.status(201).json({
      success: true,
      message: 'Discussion created successfully',
      data: newDiscussion,
    });
  } catch (error) {
    console.error('Error creating discussion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create discussion',
    });
  }
};

// Edit discussion
const editDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, body, visibility } = req.body;
    const userId = req.user._id;
    
    const discussion = await Discussion.findById(id);
    if (!discussion || discussion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }
    
    const isMod = await canModerateDeletion(userId, discussion);
    if (!isMod) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this discussion',
      });
    }
    
    if (title) discussion.title = title;
    if (description !== undefined) discussion.description = description;
    if (body) discussion.body = body;
    if (visibility) discussion.visibility = visibility;
    
    await discussion.save();
    await discussion.populate('author', 'name role');
    
    // Emit socket event
    if (req.io) {
      req.io.to(`discussion:${id}`).emit('discussion:updated', discussion);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Discussion updated successfully',
      data: discussion,
    });
  } catch (error) {
    console.error('Error editing discussion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to edit discussion',
    });
  }
};

// Delete discussion (soft delete)
const deleteDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    const discussion = await Discussion.findById(id).populate('author', 'name emailId');
    if (!discussion || discussion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }
    
    const isMod = await canModerateDeletion(userId, discussion);
    if (!isMod) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this discussion',
      });
    }
    
    discussion.isDeleted = true;
    discussion.deletedBy = userId;
    discussion.deletedAt = new Date();
    
    await discussion.save();

    const authorId = discussion.author?._id ? String(discussion.author._id) : String(discussion.author);
    const isAdmin = ['dept_admin', 'univ_admin'].includes(req.user?.role);
    const isAuthor = String(userId) === authorId;
    if (isAdmin && !isAuthor && discussion.author?.emailId) {
      const adminUser = await userModel.findById(userId).select('name role').lean();
      await sendDiscussionDeletedByAdminEmail(discussion.author, discussion, adminUser);
    }
    
    // Emit socket event
    if (req.io) {
      req.io.to(`discussion:${id}`).emit('discussion:deleted', { id });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Discussion deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting discussion:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete discussion',
    });
  }
};

// Add reply to discussion
const addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { body, parentThought } = req.body;
    const authorId = req.user._id;
    
    // Check user permission
    if (!canReplyDiscussion(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reply to discussions',
      });
    }
    
    const discussion = await Discussion.findById(id);
    if (discussion.status === 'resolved') {
      return res.status(403).json({
        success: false,
        message: 'Replies are not allowed on resolved discussions',
      });
    }
    if (!discussion || discussion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }
    
    let parentThoughtDoc = null;
    if (parentThought) {
      parentThoughtDoc = await DiscussionReply.findById(parentThought);
      if (
        !parentThoughtDoc ||
        parentThoughtDoc.isDeleted ||
        parentThoughtDoc.discussion.toString() !== id
      ) {
        return res.status(404).json({
          success: false,
          message: 'Parent thought not found',
        });
      }
      if (parentThoughtDoc.parentThought) {
        return res.status(400).json({
          success: false,
          message: 'You can only reply to a top-level thought',
        });
      }
    }

    const newReply = new DiscussionReply({
      discussion: id,
      author: authorId,
      body,
      parentThought: parentThought || null,
      moderationStatus: 'visible',
      isToxic: false,
      toxicityScore: 0,
      flaggedAt: null,
      flagReason: null,
    });

    await newReply.save();
    await newReply.populate('author', 'name role');
    
    if (parentThoughtDoc) {
      if (newReply.moderationStatus === 'visible') {
        parentThoughtDoc.thoughtReplies = parentThoughtDoc.thoughtReplies || [];
        parentThoughtDoc.thoughtReplies.push(newReply._id);
        await parentThoughtDoc.save();
      }
    }

    discussion.replyCount = (discussion.replyCount || 0) + 1;
    if (!parentThoughtDoc) {
      discussion.thoughtCount = (discussion.thoughtCount || 0) + 1;
    }
    await discussion.save();

    // Emit socket event
    if (req.io) {
      const payload = {
        discussionId: id,
        thought: newReply,
        parentThought: parentThought || null,
        thoughtCount: discussion.thoughtCount,
        replyCount: discussion.replyCount,
      };
      req.io.to(`discussion:${id}`).emit('thought:added', payload);
      req.io.to(`discussion:${id}`).emit('reply:added', payload);
    }

    const response = res.status(201).json({
      success: true,
      message: 'Thought added successfully',
      data: newReply,
      thoughtCount: discussion.thoughtCount,
      replyCount: discussion.replyCount,
    });

    setImmediate(async () => {
      try {
        const analysis = await analyzeText(String(body || ''));
        const { score = 0, isToxic = false } = analysis || {};

        if (!isToxic) {
          return;
        }

        const storedReply = await DiscussionReply.findById(newReply._id);
        if (!storedReply || storedReply.isDeleted || storedReply.moderationStatus === 'flagged') {
          return;
        }

        storedReply.moderationStatus = 'flagged';
        storedReply.isToxic = true;
        storedReply.toxicityScore = Number(score) || 0;
        storedReply.flaggedAt = new Date();
        storedReply.flagReason = 'automated_toxicity_scan';
        await storedReply.save();

        const discussionForUpdate = await Discussion.findById(id);
        if (discussionForUpdate) {
          discussionForUpdate.replyCount = Math.max(0, (discussionForUpdate.replyCount || 0) - 1);
          if (!storedReply.parentThought) {
            discussionForUpdate.thoughtCount = Math.max(0, (discussionForUpdate.thoughtCount || 0) - 1);
          }
          await discussionForUpdate.save();
        }

        if (req.io) {
          const payload = {
            discussionId: id,
            thought: storedReply,
            parentThought: storedReply.parentThought || null,
            thoughtCount: discussionForUpdate?.thoughtCount,
            replyCount: discussionForUpdate?.replyCount,
          };
          req.io.to(`discussion:${id}`).emit('thought:updated', storedReply);
          req.io.to(`discussion:${id}`).emit('reply:updated', storedReply);
          req.io.to(`discussion:${id}`).emit('thought:deleted', {
            thoughtId: storedReply._id,
            replyId: storedReply._id,
            thoughtCount: discussionForUpdate?.thoughtCount,
            replyCount: discussionForUpdate?.replyCount,
          });
          req.io.to(`discussion:${id}`).emit('reply:deleted', {
            thoughtId: storedReply._id,
            replyId: storedReply._id,
            thoughtCount: discussionForUpdate?.thoughtCount,
            replyCount: discussionForUpdate?.replyCount,
          });
        }

        try {
          await createNotification(
            authorId,
            'CONTENT_FLAGGED',
            'Your discussion reply was flagged for review',
            'Your reply was temporarily hidden and sent for admin review.',
            null,
            `/app/discussions/${id}`,
          );

          const author = await userModel.findById(authorId).select('emailId name').lean();
          await sendContentFlaggedEmail(author, {
            contentSnippet: (String(body || '')).slice(0, 300),
            contentType: 'discussion reply',
            score: Number(score) || 0,
            itemUrl: `/app/discussions/${id}`,
          });

          await auditLogModel.create({
            actorId: authorId,
            actorRole: req.user?.role || 'guest',
            actionType: 'CREATE',
            targetType: 'Comment',
            targetId: storedReply._id,
            ipAddress: req.ip,
            statusCode: 200,
            meta: { moderation: 'flagged', score: Number(score) || 0 },
          });
        } catch (sideEffectErr) {
          console.error('Error handling flagged discussion reply notifications/audit:', sideEffectErr.message);
        }
      } catch (err) {
        console.error('Error running async discussion reply moderation:', err.message);
      }
    });

    return response;
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add thought',
    });
  }
};

// Edit reply
const editReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const { body } = req.body;
    const userId = req.user._id;
    
    const reply = await DiscussionReply.findById(replyId);
    if (!reply || reply.isDeleted || reply.discussion.toString() !== id) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found',
      });
    }
    
    if (reply.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own thoughts',
      });
    }
    
    reply.body = body;
    reply.editedAt = new Date();
    reply.editedBy = userId;
    
    await reply.save();
    await reply.populate('author', 'name role');
    
    // Emit socket event
    if (req.io) {
      req.io.to(`discussion:${id}`).emit('thought:updated', reply);
      req.io.to(`discussion:${id}`).emit('reply:updated', reply);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Thought updated successfully',
      data: reply,
    });
  } catch (error) {
    console.error('Error editing reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to edit thought',
    });
  }
};

// Delete reply (soft delete)
const deleteReply = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const userId = req.user._id;
    
    const reply = await DiscussionReply.findById(replyId);
    if (!reply || reply.isDeleted || reply.discussion.toString() !== id) {
      return res.status(404).json({
        success: false,
        message: 'Thought not found',
      });
    }
    
    // Check permission (reply author, discussion author, univ_admin, or dept_admin of author's department)
    const discussion = await Discussion.findById(id);
    if (!discussion || discussion.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found',
      });
    }

    const isOwner = reply.author.toString() === userId.toString();
    const isMod = await canModerateDeletion(userId, discussion);
    if (!isOwner && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this thought',
      });
    }
    
    reply.isDeleted = true;
    reply.deletedBy = userId;
    reply.deletedAt = new Date();
    
    await reply.save();

    if (reply.parentThought) {
      await DiscussionReply.findByIdAndUpdate(reply.parentThought, {
        $pull: { thoughtReplies: reply._id },
      });
    }
    
    // Update counts:
    // - replyCount tracks total entries
    // - thoughtCount tracks only top-level thoughts
    discussion.replyCount = Math.max(0, (discussion.replyCount || 0) - 1);
    if (!reply.parentThought) {
      discussion.thoughtCount = Math.max(0, (discussion.thoughtCount || 0) - 1);
    }
    await discussion.save();
    
    // Emit socket event
    if (req.io) {
      const payload = {
        thoughtId: replyId,
        replyId,
        thoughtCount: discussion.thoughtCount,
        replyCount: discussion.replyCount,
      };
      req.io.to(`discussion:${id}`).emit('thought:deleted', payload);
      req.io.to(`discussion:${id}`).emit('reply:deleted', payload);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Thought deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete thought',
    });
  }
};

module.exports = {
  getDiscussions,
  getDiscussionDetail,
  createDiscussion,
  editDiscussion,
  deleteDiscussion,
  addReply,
  editReply,
  deleteReply,
};
