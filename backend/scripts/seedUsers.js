const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const { main } = require("../config/db");
const { userModel, ROLE_LEVELS } = require("../models/user");
const universityData = require("../university_data.json");

const DEFAULT_SEED_PASSWORD = process.env.SEED_USER_PASSWORD || "Temp@1234";

const ALLOWED_DESIGNATIONS = new Set([
  "Assistant Professor",
  "Associate Professor",
  "Professor",
]);

const normalizeText = (value) => String(value || "").trim();

const getSeniorRole = (adminRole) => {
  const normalized = normalizeText(adminRole).toLowerCase();

  if (!normalized) {
    return "senior";
  }

  if (normalized === "hod") {
    return "dept_admin";
  }

  if (normalized.includes("dean") || normalized.includes("university admin")) {
    return "univ_admin";
  }

  return "senior";
};

const safeDate = (value) => {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const buildUserRows = (data) => {
  const students = Array.isArray(data?.students) ? data.students : [];
  const seniors = Array.isArray(data?.seniors) ? data.seniors : [];

  const rows = [];
  const warnings = [];

  const seenEmails = new Set();
  const seenEnrollmentNumbers = new Set();
  const seenEmployeeIds = new Set();

  for (const student of students) {
    const emailId = normalizeText(student?.emailId).toLowerCase();
    if (!emailId) {
      warnings.push("Skipped one student with missing emailId");
      continue;
    }

    if (seenEmails.has(emailId)) {
      warnings.push(`Skipped duplicate student emailId in source: ${emailId}`);
      continue;
    }
    seenEmails.add(emailId);

    const enrollmentNumber = normalizeText(student?.enrollmentNumber).toUpperCase();
    if (!enrollmentNumber) {
      warnings.push(`Skipped student ${emailId} due to missing enrollmentNumber`);
      continue;
    }

    if (seenEnrollmentNumbers.has(enrollmentNumber)) {
      warnings.push(
        `Skipped student ${emailId} due to duplicate enrollmentNumber in source: ${enrollmentNumber}`,
      );
      continue;
    }
    seenEnrollmentNumbers.add(enrollmentNumber);

    const dob = safeDate(student?.dob);
    if (!dob) {
      warnings.push(`Student ${emailId} has invalid/missing dob and will be seeded without dob`);
    }

    rows.push({
      name: normalizeText(student?.name),
      emailId,
      legacyEmail: emailId,
      enrollmentNumber,
      legacyEnrollmentId: enrollmentNumber,
      department: normalizeText(student?.department),
      dob,
      role: "student",
      roleLevel: ROLE_LEVELS.student,
      designation: null,
      employeeId: null,
      isActive: true,
    });
  }

  for (const senior of seniors) {
    const emailId = normalizeText(senior?.emailId).toLowerCase();
    if (!emailId) {
      warnings.push("Skipped one senior with missing emailId");
      continue;
    }

    if (seenEmails.has(emailId)) {
      warnings.push(`Skipped duplicate senior emailId in source: ${emailId}`);
      continue;
    }
    seenEmails.add(emailId);

    const employeeRaw = normalizeText(senior?.employeeId).toUpperCase();
    let employeeId = employeeRaw || null;

    if (employeeId && seenEmployeeIds.has(employeeId)) {
      warnings.push(
        `Senior ${emailId} has duplicate employeeId in source (${employeeId}); employeeId omitted for this row`,
      );
      employeeId = null;
    }

    if (employeeId) {
      seenEmployeeIds.add(employeeId);
    }

    const role = getSeniorRole(senior?.adminRole);
    const designation = normalizeText(senior?.designation);

    rows.push({
      name: normalizeText(senior?.name),
      emailId,
      legacyEmail: emailId,
      employeeId,
      legacyEnrollmentId: employeeId || `SENIOR-${emailId}`,
      department: normalizeText(senior?.department),
      role,
      roleLevel: ROLE_LEVELS[role] ?? ROLE_LEVELS.senior,
      designation: ALLOWED_DESIGNATIONS.has(designation) ? designation : null,
      isActive: true,
    });
  }

  return {
    rows,
    warnings,
    sourceStudentCount: students.length,
    sourceSeniorCount: seniors.length,
  };
};

const seedUsers = async () => {
  await main();

  const {
    rows,
    warnings,
    sourceStudentCount,
    sourceSeniorCount,
  } = buildUserRows(universityData);

  if (rows.length === 0) {
    throw new Error("No valid users found in university_data.json");
  }

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);

  const operations = rows.map((row) => {
    const updateSet = {
      name: row.name,
      email: row.legacyEmail,
      enrollmentId: row.legacyEnrollmentId,
      role: row.role,
      roleLevel: row.roleLevel,
      department: row.department,
      designation: row.designation,
      isActive: row.isActive,
    };

    if (row.dob) {
      updateSet.dob = row.dob;
    }

    if (row.enrollmentNumber) {
      updateSet.enrollmentNumber = row.enrollmentNumber;
    }

    if (row.employeeId) {
      updateSet.employeeId = row.employeeId;
      updateSet.emloyeeId = row.employeeId;
    }

    return {
      updateOne: {
        filter: { emailId: row.emailId },
        update: {
          $set: updateSet,
          $setOnInsert: {
            emailId: row.emailId,
            passwordHash: defaultPasswordHash,
            adminOf: [],
          },
        },
        upsert: true,
      },
    };
  });

  const result = await userModel.collection.bulkWrite(operations, {
    ordered: false,
  });

  console.log("user seed completed");
  console.log(`source students: ${sourceStudentCount}`);
  console.log(`source seniors: ${sourceSeniorCount}`);
  console.log(`valid rows: ${rows.length}`);
  console.log(`matched: ${result.matchedCount}`);
  console.log(`modified: ${result.modifiedCount}`);
  console.log(`upserted: ${result.upsertedCount}`);

  if (warnings.length > 0) {
    console.log(`warnings: ${warnings.length}`);
    warnings.slice(0, 10).forEach((warning) => console.log(`- ${warning}`));
    if (warnings.length > 10) {
      console.log(`- ...and ${warnings.length - 10} more`);
    }
  }
};

seedUsers()
  .catch((error) => {
    console.error("user seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
