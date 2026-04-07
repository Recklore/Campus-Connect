const jwt = require("jsonwebtoken");

const verifyAccessToken = (req, res, next) => {
  const accessToken = req.cookies?.campus_connect_token;

  if (!accessToken) {
    return res.status(401).json({ success: false, message: "unauthorised" });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
    req.user = {
      ...decoded,
      userId: decoded.userId ?? decoded._id,
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
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "forbidden" });
    }
    next();
  };

module.exports = { verifyAccessToken, requireRole };
