const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const { main } = require("../config/db");
const { postModel } = require("../models/post");
const { userModel } = require("../models/user");
const { departmentModel } = require("../models/department");
const postData = require("../post_data.json");

const ALLOWED_STATUS = new Set([
  "under_review",
  "official",
  "objected",
  "rejected",
]);

const normalize = (value) => String(value || "").trim();

const getStatus = (value) => {
  const normalized = normalize(value).toLowerCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : "official";
};

const resolveLogoPath = () => {
  const candidates = [
    path.join(__dirname, "..", "curaj_logo.jpg"),
    path.join(__dirname, "..", "assets", "curaj_logo.jpg"),
    path.join(__dirname, "..", "..", "frontend", "src", "assets", "curaj.jpg"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Could not find CURAJ logo image. Expected one of: backend/curaj_logo.jpg, backend/assets/curaj_logo.jpg, frontend/src/assets/curaj.jpg",
  );
};

const inferMimeType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
};

const buildAttachmentTemplate = () => {
  const logoPath = resolveLogoPath();
  const logoBuffer = fs.readFileSync(logoPath);

  return {
    originalName: "curaj_logo" + path.extname(logoPath).toLowerCase(),
    mimeType: inferMimeType(logoPath),
    size: logoBuffer.length,
    checksum: crypto.createHash("sha256").update(logoBuffer).digest("hex"),
  };
};

const seedPosts = async () => {
  await main();

  if (!Array.isArray(postData) || postData.length === 0) {
    throw new Error("No valid posts found in post_data.json");
  }

  const requestedCodes = [
    ...new Set(postData.map((post) => normalize(post.departmentCode).toUpperCase()).filter(Boolean)),
  ];
  const requestedEmails = [
    ...new Set(postData.map((post) => normalize(post.authorEmail).toLowerCase()).filter(Boolean)),
  ];

  const [departments, users] = await Promise.all([
    departmentModel
      .find({ deptCode: { $in: requestedCodes }, isActive: true })
      .select("_id deptCode")
      .lean(),
    userModel
      .find({ emailId: { $in: requestedEmails }, isActive: true })
      .select("_id emailId")
      .lean(),
  ]);

  const deptByCode = new Map(departments.map((dept) => [dept.deptCode, dept]));
  const userByEmail = new Map(users.map((user) => [user.emailId, user]));

  const attachmentTemplate = buildAttachmentTemplate();

  const warnings = [];
  const operations = [];

  for (let index = 0; index < postData.length; index += 1) {
    const row = postData[index];
    const title = normalize(row.title);
    const body = normalize(row.body);
    const departmentCode = normalize(row.departmentCode).toUpperCase();
    const authorEmail = normalize(row.authorEmail).toLowerCase();

    if (!title || !body || !departmentCode || !authorEmail) {
      warnings.push(`Skipped row ${index + 1} due to missing required fields`);
      continue;
    }

    const department = deptByCode.get(departmentCode);
    if (!department) {
      warnings.push(`Skipped row ${index + 1}: departmentCode not found (${departmentCode})`);
      continue;
    }

    const author = userByEmail.get(authorEmail);
    if (!author) {
      warnings.push(`Skipped row ${index + 1}: authorEmail not found (${authorEmail})`);
      continue;
    }

    const status = getStatus(row.status);
    const reviewExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    operations.push({
      updateOne: {
        filter: {
          title,
          author: author._id,
          department: department._id,
        },
        update: {
          $set: {
            body,
            status,
            reviewExpiresAt,
            attachment: [
              {
                ...attachmentTemplate,
                storedName: `seed-${index + 1}-${Date.now()}${path.extname(attachmentTemplate.originalName)}`,
              },
            ],
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
          },
          $setOnInsert: {
            title,
            author: author._id,
            department: department._id,
            objections: [],
            commentCount: 0,
          },
        },
        upsert: true,
      },
    });
  }

  if (operations.length === 0) {
    throw new Error("No valid post rows remained after validation");
  }

  const result = await postModel.bulkWrite(operations, { ordered: false });

  console.log("post seed completed");
  console.log(`source rows: ${postData.length}`);
  console.log(`valid rows: ${operations.length}`);
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

seedPosts()
  .catch((error) => {
    console.error("post seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
