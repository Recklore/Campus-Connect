const jwt = require("jsonwebtoken");
const { userModel } = require("../models/user");

const verifyAccessToken = (req, res, next) => {
  const accessToken = req.cookies?.campus_connect_token;

  if (!accessToken) {
    return res.status(401).json({ success: false, message: "unauthorised" });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
    req.user = {
      ...decoded,
      _id: decoded._id,
    };
    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "session expired" });
    }
    return res.status(401).json({ success: false, message: "unauthorised" });
  }
};

const requireRole =
  (...roles) =>
  async (req, res, next) => {
    try {
      if (!req.user?._id) {
        return res.status(401).json({ success: false, message: "unauthorised" });
      }

      const currentUser = await userModel
        .findById(req.user._id)
        .select("role roleLevel isActive")
        .lean();

      if (!currentUser || currentUser.isActive === false) {
        return res.status(401).json({ success: false, message: "unauthorised" });
      }

      req.user.role = currentUser.role;
      req.user.roleLevel = currentUser.roleLevel;

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "forbidden" });
      }

      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: "internal server error" });
    }
  };

module.exports = { verifyAccessToken, requireRole };
