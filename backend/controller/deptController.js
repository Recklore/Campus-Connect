const { departmentModel } = require("../models/department");
const { subscriptionModel } = require("../models/subscription");

const getAllDepartments = async (req, res) => {
  try {
    const departments = await departmentModel
      .find({ isActive: true })
      .select("deptName deptCode description subscriberCount school displayImage")
      .sort({ school: 1, deptName: 1 });

    const grouped = departments.reduce((acc, dept) => {
      if (!acc[dept.school]) acc[dept.school] = [];
      acc[dept.school].push(dept);
      return acc;
    }, {});

    return res.status(200).json({ success: true, data: grouped });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const toggleSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const deptId = req.params.id;

    const dept = await departmentModel.findById(deptId);
    if (!dept || !dept.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "department not found" });
    }

    const existing = await subscriptionModel.findOne({
      user: userId,
      department: deptId,
    });

    if (existing) {
      await existing.deleteOne();
      await departmentModel.findByIdAndUpdate(deptId, {
        $inc: { subscriberCount: -1 },
      });
      return res.status(200).json({ success: true, subscribed: false });
    } else {
      await subscriptionModel.create({
        user: userId,
        department: deptId,
      });
      await departmentModel.findByIdAndUpdate(deptId, {
        $inc: { subscriberCount: 1 },
      });
      return res.status(200).json({ success: true, subscribed: true });
    }
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

const getMySubscription = async (req, res) => {
  try {
    if (!req.user._id) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }

    const subscriptions = await subscriptionModel
      .find({ user: req.user._id })
      .populate("department", "deptName deptCode school displayImage")
      .sort({ createdAt: -1 });

    const departments = subscriptions.map((s) => s.department);
    return res.status(200).json({ success: true, data: departments });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "internal server error" });
  }
};

module.exports = { getAllDepartments, toggleSubscription, getMySubscription };
