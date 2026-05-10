const getClientIp = (req) => {

  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0].trim();
    if (clientIp) return clientIp;
  }

  if (req.ip) {
    return req.ip;
  }

  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }

  return null;
};

const setupTrustProxy = (app, hops = 1) => {
  app.set("trust proxy", hops);
};

module.exports = { getClientIp, setupTrustProxy };
