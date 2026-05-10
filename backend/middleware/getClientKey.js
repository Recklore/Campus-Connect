const rateLimit = require("express-rate-limit");
const { getClientIp } = require("../lib/ipExtraction");

function getClientKey(req, prefix = "guest") {
  const fp = req.headers["x-device-fingerprint"];
  const isValidFp = fp && /^[a-f0-9]{64}$/.test(fp);
  const normalizedIp = rateLimit.ipKeyGenerator(getClientIp(req));
  return isValidFp ? `${prefix}:fp:${fp}` : `${prefix}:ip:${normalizedIp}`;
}

module.exports = { getClientKey };
