const { userModel } = require("../models/user");
const { subscriptionModel } = require("../models/subscription");
const { departmentModel } = require("../models/department");
const mongoose = require("mongoose");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const STOP_WORDS = new Set(["and", "of", "the", "for", "in", "to", "department", "school"]);
const getSignificantWords = (value) =>
  normalizeText(value)
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
const getAbbreviation = (value) => getSignificantWords(value).map((word) => word[0]).join("");

const scoreDepartmentMatch = (department, targetText) => {
  const deptName = normalizeText(department.deptName);
  const deptCode = normalizeText(department.deptCode);
  const school = normalizeText(department.school);
  const deptWords = getSignificantWords(department.deptName);
  const deptWordSet = new Set(deptWords);
  const targetWords = getSignificantWords(targetText);
  const targetWordSet = new Set(targetWords);
  const targetAbbreviation = normalizeText(getAbbreviation(targetText));
  const deptAbbreviation = normalizeText(getAbbreviation(department.deptName) || department.deptCode);

  if (!targetText) return 0;
  if (deptCode === targetAbbreviation) return 100;
  if (deptAbbreviation === targetAbbreviation) return 95;
  if (deptName === normalizeText(targetText)) return 90;

  const sharedWords = [...targetWordSet].filter((word) => deptWordSet.has(word)).length;
  const minWords = Math.min(targetWords.length, deptWords.length);

  if (targetWords.length > 0 && deptWords.length > 0 && sharedWords === minWords) return 80;
  if (deptName.includes(normalizeText(targetText)) || normalizeText(targetText).includes(deptName)) return 70;
  if (deptCode.includes(normalizeText(targetText)) || normalizeText(targetText).includes(deptCode)) return 65;
  if (school.includes(normalizeText(targetText)) || normalizeText(targetText).includes(school)) return 50;
  if (sharedWords > 0) return 40 + sharedWords;

  return 0;
};

const pickBestDepartment = (departments, targetText) => {
  let bestDepartment = null;
  let bestScore = 0;

  for (const department of departments) {
    const score = scoreDepartmentMatch(department, targetText);
    if (score > bestScore) {
      bestScore = score;
      bestDepartment = department;
    }
  }

  return bestDepartment;
};

const getDepartmentForUser = async (user) => {
  const adminOf = Array.isArray(user.adminOf) ? user.adminOf : [];

  if (adminOf.length > 0) {
    const dept = await departmentModel
      .findById(adminOf[0])
      .select("deptName deptCode school subscriberCount");

    if (dept) {
      return dept;
    }
  }

  const departmentText = String(user.department || "").trim();
  if (!departmentText) {
    return null;
  }

  const deptRegex = new RegExp(`^${escapeRegex(departmentText)}$`, "i");
  const containsRegex = new RegExp(escapeRegex(departmentText), "i");

  const allDepartments = await departmentModel
    .find({ isActive: true })
    .select("deptName deptCode school subscriberCount");
  return pickBestDepartment(allDepartments, departmentText);
};

const getMe = async (req, res) => {
  try {
    const userObjectId = req.user?._id || null;
    const isGuestSession = req.user?.role === "guest" && !userObjectId;

    if (isGuestSession) {
      return res.status(200).json({
        success: true,
        data: {
          _id: null,
          name: "Guest",
          role: "guest",
          roleLevel: 0,
          designation: null,
          department: null,
          emailId: null,
          enrollmentNumber: null,
          employeeId: null,
          subscriptionCount: 0,
          departmentSubscriberCount: null,
          departmentInfo: null,
        },
      });
    }

    if (!userObjectId) {
      return res.status(401).json({ success: false, message: "unauthorised" });
    }

    const user = await userModel
      .findById(userObjectId)
      .select(
        "name role roleLevel designation department emailId enrollmentNumber employeeId adminOf",
      )
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "user not found" });
    }

    const subscriptionCount = await subscriptionModel.countDocuments({ user: userObjectId });
    const department = await getDepartmentForUser(user);

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        role: user.role,
        roleLevel: user.roleLevel,
        designation: user.designation,
        department: user.department,
        emailId: user.emailId,
        enrollmentNumber: user.enrollmentNumber,
        employeeId: user.employeeId,
        subscriptionCount,
        departmentSubscriberCount: department?.subscriberCount ?? null,
        departmentInfo: department
          ? {
              _id: department._id,
              deptName: department.deptName,
              deptCode: department.deptCode,
              school: department.school,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getMe error: ", error);
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const buildUserSearchQuery = (q) => {
  const safe = String(q || "").trim();
  const escaped = escapeRegex(safe);
  const startsWith = new RegExp(`^${escaped}`, "i");
  const contains = new RegExp(escaped, "i");

  return {
    isActive: true,
    $or: [
      { name: contains },
      { emailId: contains },
      { enrollmentNumber: startsWith },
      { employeeId: startsWith },
      { department: contains },
    ],
  };
};

const buildDepartmentSearchQuery = (q) => {
  const safe = String(q || "").trim();
  const escaped = escapeRegex(safe);
  const contains = new RegExp(escaped, "i");

  return {
    isActive: true,
    $or: [{ deptName: contains }, { deptCode: contains }, { school: contains }],
  };
};

const searchUsersAndDepartments = async (req, res) => {
  try {
    const q = String(req.query?.q || "").trim();
    const type = String(req.query?.type || "all").toLowerCase();
    const pageRaw = Number(req.query?.page || 1);
    const limitRaw = Number(req.query?.limit || 10);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);
    const limit = Number.isNaN(limitRaw) ? 10 : Math.min(Math.max(limitRaw, 1), 25);
    const skip = (page - 1) * limit;

    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "query must be at least 2 characters",
      });
    }

    if (!["all", "users", "departments"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "invalid type filter",
      });
    }

    let users = [];
    let departments = [];
    let totalUsers = 0;
    let totalDepartments = 0;

    if (type === "all" || type === "users") {
      const userQuery = buildUserSearchQuery(q);
      totalUsers = await userModel.countDocuments(userQuery);
      users = await userModel
        .find(userQuery)
        .select("name role designation department emailId enrollmentNumber employeeId")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    if (type === "all" || type === "departments") {
      const deptQuery = buildDepartmentSearchQuery(q);
      totalDepartments = await departmentModel.countDocuments(deptQuery);
      departments = await departmentModel
        .find(deptQuery)
        .select("deptName deptCode school subscriberCount displayImage")
        .sort({ deptName: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    const hasMoreUsers = type !== "departments" ? skip + users.length < totalUsers : false;
    const hasMoreDepartments =
      type !== "users" ? skip + departments.length < totalDepartments : false;
    const hasMore = hasMoreUsers || hasMoreDepartments;

    return res.status(200).json({
      success: true,
      data: {
        users,
        departments,
        page,
        limit,
        totalUsers,
        totalDepartments,
        hasMoreUsers,
        hasMoreDepartments,
        hasMore,
      },
    });
  } catch (error) {
    console.error("searchUsersAndDepartments error: ", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
};

const getUserProfileById = async (req, res) => {
  try {
    const userId = String(req.params?.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "invalid user id" });
    }

    const user = await userModel
      .findById(userId)
      .select(
        "name role roleLevel designation department emailId enrollmentNumber employeeId adminOf isActive",
      )
      .lean();

    if (!user || user.isActive === false) {
      return res.status(404).json({ success: false, message: "user not found" });
    }

    const subscriptionCount = await subscriptionModel.countDocuments({ user: user._id });
    const department = await getDepartmentForUser(user);

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        role: user.role,
        roleLevel: user.roleLevel,
        designation: user.designation,
        department: user.department,
        emailId: user.emailId,
        enrollmentNumber: user.enrollmentNumber,
        employeeId: user.employeeId,
        subscriptionCount,
        departmentSubscriberCount: department?.subscriberCount ?? null,
        departmentInfo: department
          ? {
              _id: department._id,
              deptName: department.deptName,
              deptCode: department.deptCode,
              school: department.school,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getUserProfileById error: ", error);
    return res.status(500).json({ success: false, message: "internal server error" });
  }
};

module.exports = { getMe, searchUsersAndDepartments, getUserProfileById };
