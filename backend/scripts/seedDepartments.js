const mongoose = require("mongoose");

const { main } = require("../config/db");
const { departmentModel } = require("../models/department");
const departmentData = require("../department_data.json");

const flattenDepartments = (data) => {
  const byCode = new Map();

  for (const schoolEntry of data) {
    const school = String(schoolEntry?.school || "").trim();
    const displayImage = String(schoolEntry?.imageUrl || "").trim();

    if (!school || !Array.isArray(schoolEntry?.departments)) {
      continue;
    }

    for (const dept of schoolEntry.departments) {
      const deptName = String(dept?.name || "").trim();
      const deptCode = String(dept?.code || "").trim().toUpperCase();

      if (!deptName || !deptCode) {
        continue;
      }

      byCode.set(deptCode, {
        deptName,
        deptCode,
        school,
        description: "",
        displayImage,
        isActive: true,
      });
    }
  }

  return Array.from(byCode.values());
};

const seedDepartments = async () => {
  await main();

  const departments = flattenDepartments(departmentData);

  if (departments.length === 0) {
    throw new Error("No valid departments found in department_data.json");
  }

  const operations = departments.map((dept) => ({
    updateOne: {
      filter: { deptCode: dept.deptCode },
      update: {
        $set: {
          deptName: dept.deptName,
          school: dept.school,
          description: dept.description,
          displayImage: dept.displayImage,
          isActive: dept.isActive,
        },
        $setOnInsert: {
          deptCode: dept.deptCode,
          subscriberCount: 0,
        },
      },
      upsert: true,
    },
  }));

  const result = await departmentModel.bulkWrite(operations, { ordered: false });

  console.log("department seed completed");
  console.log(`source entries: ${departments.length}`);
  console.log(`matched: ${result.matchedCount}`);
  console.log(`modified: ${result.modifiedCount}`);
  console.log(`upserted: ${result.upsertedCount}`);
};

seedDepartments()
  .catch((error) => {
    console.error("department seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
