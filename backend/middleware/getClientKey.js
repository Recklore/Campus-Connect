export function getClientKey(req, prefix = "guest") {
  const fp = req.headers["x-device-fingerprint"];
  const isValidFp = fp && /^[a-f0-9]{64}$/.test(fp);
  return isValidFp ? `${prefix}:fp:${fp}` : `${prefix}:ip:${req.ip}`;
}
