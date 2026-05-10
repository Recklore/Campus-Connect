const { departmentModel } = require("../models/department");
const { userModel } = require("../models/user");
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

  const targetHasWords = targetWords.length > 0;
  const deptHasWords = deptWords.length > 0;
  const sharedWords = [...targetWordSet].filter((word) => deptWordSet.has(word)).length;
  const minWords = Math.min(targetWords.length, deptWords.length);

  if (targetHasWords && deptHasWords && sharedWords === minWords) return 80;
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

async function resolveDepartmentForUser(user) {
  if (!user) return null;

  const departmentText = String(user.department || "").trim();
  if (!departmentText) return null;

  const exactCode = departmentText.toUpperCase();
  const exactName = new RegExp(`^${escapeRegex(departmentText)}$`, "i");
  const contains = new RegExp(escapeRegex(departmentText), "i");

  const departments = await departmentModel.find({ isActive: true }).select("deptName deptCode school");
  return pickBestDepartment(departments, departmentText);
}

async function resolveDepartmentFromInput({ departmentId, departmentName, departmentCode } = {}) {
  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    const byId = await departmentModel.findById(departmentId);
    if (byId) return byId;
  }

  const nameText = String(departmentName || "").trim();
  const codeText = String(departmentCode || "").trim();

  if (codeText) {
    const candidates = await departmentModel.find({ isActive: true }).select("deptName deptCode school");
    const byCode = pickBestDepartment(candidates, codeText.toUpperCase());
    if (byCode) return byCode;
  }

  if (nameText) {
    const departments = await departmentModel.find({ isActive: true }).select("deptName deptCode school");
    return pickBestDepartment(departments, nameText);
  }

  return null;
}

function actorHasDeptAdminRights(actor, deptId) {
  if (!actor) return false;
  if (actor.role === "univ_admin") return true;
  const adminOf = (actor.adminOf || []).map((d) => d.toString());
  return adminOf.includes(deptId.toString());
}

async function countDeptAdmins(deptId) {
  return await userModel.countDocuments({ adminOf: deptId, role: "dept_admin" });
}

async function validateReplacement(replacementId) {
  const replacement = await userModel.findById(replacementId);
  if (!replacement) return { ok: false, message: "Replacement user not found" };
  if (!replacement.employeeId || replacement.enrollmentNumber) {
    return { ok: false, message: "Replacement must be a senior with employeeId and no enrollmentNumber" };
  }
  return { ok: true, replacement };
}

module.exports = { resolveDepartmentForUser, resolveDepartmentFromInput, actorHasDeptAdminRights, countDeptAdmins, validateReplacement };
