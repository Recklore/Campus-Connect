const mongoose = require("mongoose");
const { userModel, ROLE_LEVELS } = require("../models/user");
const { auditLogModel } = require("../models/auditLog");
const { departmentModel } = require("../models/department");
const { resolveDepartmentForUser, resolveDepartmentFromInput, actorHasDeptAdminRights, countDeptAdmins, validateReplacement } = require("./adminHelpers");
const { commentModel } = require("../models/comment");
const DiscussionReply = require("../models/discussionReply");
const { createNotification } = require("../services/notificationService");
const { sendContentFlaggedEmail } = require("../services/mailNotificationService");

const ensureObjectIdArray = (value) => (Array.isArray(value) ? value : []);

async function promoteUser(req, res) {
  const actor = req.user;
  const { userId } = req.params;
  const { targetRole, departmentId } = req.body;

  if (!targetRole) {
    return res.status(400).json({ success: false, message: "targetRole is required" });
  }

  try {
    const target = await userModel.findById(userId);
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    if (actor.role === "dept_admin") {
      const targetDept = await resolveDepartmentForUser(target);
      if (!targetDept) return res.status(400).json({ success: false, message: "Target user's department not found" });
      if (!actorHasDeptAdminRights(actor, targetDept._id)) {
        return res.status(403).json({ success: false, message: "Not authorized for this department" });
      }
    }




    if (targetRole === "senior") {

      if (target.role !== "student") {
        return res.status(400).json({ success: false, message: "Only students can be promoted to senior" });
      }

      target.role = "senior";
      target.roleLevel = ROLE_LEVELS.senior;
  
      await target.save();

      try {
        await auditLogModel.create({
          actorId: actor._id,
          actorRole: actor.role,
          actionType: "UPDATE",
          targetType: "User",
          targetId: target._id,
          ipAddress: req.ip,
        });
        // Mark request as audited to avoid duplicate middleware entry
        req.auditLogged = true;
      } catch (auditError) {
        console.error("promoteUser audit log error:", auditError);
      }

      return res.status(200).json({ success: true, message: "User promoted to senior", data: { userId: target._id } });
    }

    if (targetRole === "dept_admin") {
      // Only univ_admin can promote to dept_admin and target must be a senior with employeeId and not an enrolled student
      if (actor.role !== "univ_admin") {
        return res.status(403).json({ success: false, message: "Only university admins can promote to dept_admin" });
      }

      if (target.role !== "senior") {
        return res.status(400).json({ success: false, message: "Only seniors can be promoted to dept_admin" });
      }

      if (!target.employeeId || target.enrollmentNumber) {
        return res.status(400).json({ success: false, message: "Target must have an employeeId and must not have an enrollmentNumber" });
      }

      let dept = await resolveDepartmentFromInput({
        departmentId,
        departmentName: target.department,
        departmentCode: target.department,
      });

      if (!dept) {
        dept = await resolveDepartmentForUser(target);
      }

      if (!dept) {
        return res.status(400).json({
          success: false,
          message: "departmentId is required to assign dept_admin and the user's department could not be resolved",
        });
      }

      // Add department to adminOf if not already present
      const normalizedAdminOf = ensureObjectIdArray(target.adminOf);
      const adminOf = normalizedAdminOf.map((d) => d.toString());
      if (!adminOf.includes(dept._id.toString())) {
        target.adminOf = normalizedAdminOf;
        target.adminOf.push(dept._id);
      }
      target.role = "dept_admin";
      target.roleLevel = ROLE_LEVELS.dept_admin;
      await target.save();

      try {
        await auditLogModel.create({
          actorId: actor._id,
          actorRole: actor.role,
          actionType: "UPDATE",
          targetType: "User",
          targetId: target._id,
          ipAddress: req.ip,
        });
        // Mark request as audited to avoid duplicate middleware entry
        req.auditLogged = true;
      } catch (auditError) {
        console.error("promoteUser audit log error:", auditError);
      }

      return res.status(200).json({ success: true, message: "User promoted to dept_admin", data: { userId: target._id } });
    }

    return res.status(400).json({ success: false, message: "Unsupported targetRole" });
  } catch (error) {
    console.error("promoteUser error:", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
}

async function demoteUser(req, res) {
  const actor = req.user;
  const { userId } = req.params;
  const { targetRole, departmentId, appointBeforeDemoteId } = req.body;

  if (!targetRole) {
    return res.status(400).json({ success: false, message: "targetRole is required" });
  }

  try {
    const target = await userModel.findById(userId);
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    // dept_admin can only act within their adminOf departments
    if (actor.role === "dept_admin") {
      const targetDept = await resolveDepartmentForUser(target);
      if (!targetDept) return res.status(400).json({ success: false, message: "Target user's department not found" });
      if (!actorHasDeptAdminRights(actor, targetDept._id)) {
        return res.status(403).json({ success: false, message: "Not authorized for this department" });
      }
    }

    if (targetRole === "student") {
      // dept_admin and univ_admin can demote senior -> student
      if (target.role !== "senior") {
        return res.status(400).json({ success: false, message: "Only seniors can be demoted to student" });
      }

      // demote: set role to student and remove employeeId/designation
      target.role = "student";
      target.employeeId = undefined;
      target.designation = null;
      await target.save();

      await auditLogModel.create({
        actorId: actor._id,
        actorRole: actor.role,
        actionType: "UPDATE",
        targetType: "User",
        targetId: target._id,
        ipAddress: req.ip,
      });
      req.auditLogged = true;

      return res.status(200).json({ success: true, message: "User demoted to student", data: { userId: target._id } });
    }

    if (targetRole === "senior") {
      // univ_admin can demote dept_admin -> senior, but ensure at least one dept_admin remains
      if (target.role !== "dept_admin") {
        return res.status(400).json({ success: false, message: "Only dept_admins can be demoted to senior" });
      }

      if (actor.role !== "univ_admin") {
        return res.status(403).json({ success: false, message: "Only university admins can demote dept_admins" });
      }

      let dept = await resolveDepartmentFromInput({
        departmentId,
        departmentName: target.department,
        departmentCode: target.department,
      });

      if (!dept) {
        dept = await resolveDepartmentForUser(target);
      }

      if (!dept) {
        return res.status(400).json({ success: false, message: "departmentId is required and the department could not be resolved" });
      }

      // count current dept_admins for this department
      const currentAdmins = await countDeptAdmins(dept._id);
      if (currentAdmins <= 1) {
        // need appointBeforeDemoteId to first appoint another admin
        if (!appointBeforeDemoteId) {
          return res.status(409).json({ success: false, message: "Operation would leave department without any dept_admin. Please appoint a replacement first." });
        }

        // appoint the replacement
        const replacementCheck = await validateReplacement(appointBeforeDemoteId);
        if (!replacementCheck.ok) return res.status(400).json({ success: false, message: replacementCheck.message });
        const replacement = replacementCheck.replacement;

        // add dept to replacement.adminOf if not present and set role
        const normalizedReplacementAdminOf = ensureObjectIdArray(replacement.adminOf);
        const repAdminOf = normalizedReplacementAdminOf.map((d) => d.toString());
        if (!repAdminOf.includes(dept._id.toString())) {
          replacement.adminOf = normalizedReplacementAdminOf;
          replacement.adminOf.push(dept._id);
        }
        replacement.role = "dept_admin";
        await replacement.save();

        await auditLogModel.create({
          actorId: actor._id,
          actorRole: actor.role,
          actionType: "UPDATE",
          targetType: "User",
          targetId: replacement._id,
          ipAddress: req.ip,
        });
        req.auditLogged = true;
      }

      // now demote the original
      // remove department from their adminOf
      target.adminOf = ensureObjectIdArray(target.adminOf).filter((d) => d.toString() !== dept._id.toString());
      // if they have no more adminOf entries, set role to senior
      if ((target.adminOf || []).length === 0) {
        target.role = "senior";
      }
      await target.save();

      await auditLogModel.create({
        actorId: actor._id,
        actorRole: actor.role,
        actionType: "UPDATE",
        targetType: "User",
        targetId: target._id,
        ipAddress: req.ip,
      });
      req.auditLogged = true;

      return res.status(200).json({ success: true, message: "Dept admin demoted", data: { userId: target._id } });
    }

    return res.status(400).json({ success: false, message: "Unsupported targetRole for demotion" });
  } catch (error) {
    console.error("demoteUser error:", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
}

module.exports = { promoteUser, demoteUser };

// --- Moderation admin endpoints ---
async function _resolveModelByType(type) {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (t === "comment") return { model: commentModel, targetType: 'Comment' };
  if (t === "discussion") return { model: DiscussionReply, targetType: 'DiscussionReply' };
  return null;
}

async function getFlags(req, res) {
  try {
    const { type = null, limit = 20, skip = 0 } = req.query;
    const resolved = type ? await _resolveModelByType(type) : null;

    if (resolved) {
      const items = await resolved.model.find({ moderationStatus: 'flagged', isDeleted: false })
        .sort({ flaggedAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .populate('author', 'name emailId role');

      const totalCount = await resolved.model.countDocuments({ moderationStatus: 'flagged', isDeleted: false });

      return res.status(200).json({ success: true, data: items, totalCount, limit: Number(limit), skip: Number(skip) });
    }

    // If no type specified, gather both types
    const [comments, discussions] = await Promise.all([
      commentModel.find({ moderationStatus: 'flagged', isDeleted: false }).sort({ flaggedAt: -1 }).limit(Number(limit)).skip(Number(skip)).populate('author', 'name emailId role'),
      DiscussionReply.find({ moderationStatus: 'flagged', isDeleted: false }).sort({ flaggedAt: -1 }).limit(Number(limit)).skip(Number(skip)).populate('author', 'name emailId role'),
    ]);

    const totalCount = (await commentModel.countDocuments({ moderationStatus: 'flagged', isDeleted: false })) + (await DiscussionReply.countDocuments({ moderationStatus: 'flagged', isDeleted: false }));

    return res.status(200).json({ success: true, data: { comments, discussions }, totalCount, limit: Number(limit), skip: Number(skip) });
  } catch (error) {
    console.error('getFlags error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
}

async function getFlagDetail(req, res) {
  try {
    const { type, id } = req.params;
    const resolved = await _resolveModelByType(type);
    if (!resolved) return res.status(400).json({ success: false, message: 'invalid type' });

    const item = await resolved.model.findById(id).populate('author', 'name emailId role');
    if (!item) return res.status(404).json({ success: false, message: 'flagged item not found' });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('getFlagDetail error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
}

async function approveFlag(req, res) {
  try {
    const { type, id } = req.params;
    const resolved = await _resolveModelByType(type);
    if (!resolved) return res.status(400).json({ success: false, message: 'invalid type' });

    const item = await resolved.model.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'flagged item not found' });

    // Only operate if currently flagged or soft_deleted
    const prevStatus = item.moderationStatus;
    item.moderationStatus = 'visible';
    item.isToxic = false;
    item.toxicityScore = 0;
    item.flaggedAt = null;
    item.flagReason = null;

    await item.save();

    // Update parent counts if needed
    if (type === 'comment' && prevStatus === 'flagged') {
      const post = await require('../models/post').postModel.findById(item.post).select('commentCount');
      if (post) {
        await require('../models/post').postModel.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
      }
    }

    if (type === 'discussion' && prevStatus === 'flagged') {
      const discussion = await require('../models/discussion').findById(item.discussion).select('replyCount thoughtCount');
      if (discussion) {
        const isTop = !item.parentThought;
        await require('../models/discussion').findByIdAndUpdate(discussion._id, { $inc: { replyCount: 1, ...(isTop ? { thoughtCount: 1 } : {}) } });
      }
    }

    // Notify author
    try {
      await createNotification(item.author, 'CONTENT_APPROVED', 'Your content is restored', 'An admin has reviewed your content and restored it.');
    } catch (nerr) {
      console.error('approveFlag notification error:', nerr.message);
    }

    await auditLogModel.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      actionType: 'UPDATE',
      targetType: resolved.targetType,
      targetId: item._id,
      ipAddress: req.ip,
      meta: { action: 'approve_flag' },
    });

    return res.status(200).json({ success: true, message: 'Item approved and restored', data: item });
  } catch (error) {
    console.error('approveFlag error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
}

async function rejectFlag(req, res) {
  try {
    const { type, id } = req.params;
    const { hard = false } = req.body || {};
    const resolved = await _resolveModelByType(type);
    if (!resolved) return res.status(400).json({ success: false, message: 'invalid type' });

    const item = await resolved.model.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'flagged item not found' });

    if (hard) {
      // permanent delete
      await resolved.model.deleteOne({ _id: item._id });
    } else {
      item.moderationStatus = 'soft_deleted';
      item.isDeleted = true;
      item.deletedAt = new Date();
      item.deletedBy = req.user._id;
      await item.save();
    }

    // Adjust parent counts if necessary
    if (type === 'comment') {
      await require('../models/post').postModel.updateOne({ _id: item.post }, { $inc: { commentCount: -1 } });
    }

    if (type === 'discussion') {
      const isTop = !item.parentThought;
      const inc = { replyCount: -1 };
      if (isTop) inc.thoughtCount = -1;
      await require('../models/discussion').findByIdAndUpdate(item.discussion, { $inc: inc });
    }

    // Notify author
    try {
      await createNotification(item.author, 'CONTENT_REJECTED', 'Your content was removed', 'An admin has removed your content after review.');
    } catch (nerr) {
      console.error('rejectFlag notification error:', nerr.message);
    }

    await auditLogModel.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      actionType: 'DELETE',
      targetType: resolved.targetType,
      targetId: item._id,
      ipAddress: req.ip,
      meta: { action: 'reject_flag', hard: !!hard },
    });

    return res.status(200).json({ success: true, message: 'Item rejected', data: { id: item._id, hard: !!hard } });
  } catch (error) {
    console.error('rejectFlag error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
}

async function restoreFlag(req, res) {
  try {
    const { type, id } = req.params;
    const resolved = await _resolveModelByType(type);
    if (!resolved) return res.status(400).json({ success: false, message: 'invalid type' });

    const item = await resolved.model.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'flagged item not found' });

    item.moderationStatus = 'visible';
    item.isDeleted = false;
    item.deletedAt = null;
    item.deletedBy = null;
    item.isToxic = false;
    item.toxicityScore = 0;
    item.flaggedAt = null;
    item.flagReason = null;
    await item.save();

    // Restore parent counts
    if (type === 'comment') {
      await require('../models/post').postModel.updateOne({ _id: item.post }, { $inc: { commentCount: 1 } });
    }

    if (type === 'discussion') {
      const isTop = !item.parentThought;
      await require('../models/discussion').findByIdAndUpdate(item.discussion, { $inc: { replyCount: 1, ...(isTop ? { thoughtCount: 1 } : {}) } });
    }

    try {
      await createNotification(item.author, 'CONTENT_RESTORED', 'Your content has been restored', 'An admin restored your content after review.');
    } catch (nerr) {
      console.error('restoreFlag notification error:', nerr.message);
    }

    await auditLogModel.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      actionType: 'UPDATE',
      targetType: resolved.targetType,
      targetId: item._id,
      ipAddress: req.ip,
      meta: { action: 'restore_flag' },
    });

    return res.status(200).json({ success: true, message: 'Item restored', data: item });
  } catch (error) {
    console.error('restoreFlag error:', error);
    return res.status(500).json({ success: false, message: 'internal server error' });
  }
}

module.exports = { promoteUser, demoteUser, getFlags, getFlagDetail, approveFlag, rejectFlag, restoreFlag };
