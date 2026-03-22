const enrollmentRegex = /^\d{4}[A-Z]{4,6}\d{3}$/;
const curajDomain = /@curaj\.ac\.in$/i;

export const isStrongPassword = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return (
    value.length >= 8 &&
    value.length <= 64 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
};

export const validateIdentifier = (role, value) => {
  const normalized = String(value || "").trim();

  if (role === "student") {
    return enrollmentRegex.test(normalized.toUpperCase());
  }

  return normalized.length >= 13 && normalized.length <= 50 && curajDomain.test(normalized);
};

export const normalizeIdentifier = (role, value) => {
  const normalized = String(value || "").trim();

  if (role === "student") {
    return normalized.toUpperCase();
  }

  return normalized.toLowerCase();
};
