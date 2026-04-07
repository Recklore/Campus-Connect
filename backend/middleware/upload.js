const multer = require("multer");

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 5;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_FILE_TYPE"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILE_COUNT,
  },
});

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: `each file must be under ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: `a post cant have more than ${MAX_FILE_COUNT} attachments`,
      });
    }
  }

  if (err.message === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: `Only JPEG, PNG, WebP, PDF files are allowed`,
    });
  }

  next(err);
};

module.exports = { upload, handleUploadError };
