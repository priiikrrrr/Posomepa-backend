const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../services/cloudinaryService');

const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, stamp + path.extname(file.originalname));
  }
});

const hostAppStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'posomepa/host-applications',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_DOCS_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(new Error(`"${file.mimetype}" not allowed, images only`), false);
};

const docFileFilter = (_req, file, cb) => {
  if (ALLOWED_DOCS_MIME.has(file.mimetype)) return cb(null, true);
  cb(new Error(`"${file.mimetype}" not allowed, images and PDFs only`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    files: 10
  }
});

// For host application documents (ID, selfie, proofs)
const hostAppUpload = multer({
  storage: hostAppStorage,
  fileFilter: docFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 6 // idImage, selfie, addressProof, businessProof, etc.
  }
});

exports.uploadImages = upload.array('images', 10);
exports.uploadMiddleware = upload;
exports.uploadHostAppDocs = hostAppUpload.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'businessProof', maxCount: 1 }
]);