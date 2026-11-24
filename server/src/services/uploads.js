// Image uploads (posts, menu items, logos, avatars). Stored on disk under /uploads.
// For production, swap the storage for S3 / Azure Blob with the same fileUrl() contract.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = process.env.WAGFA_UPLOADS || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + ALLOWED[file.mimetype])
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const e = new Error('الصورة لازم تكون JPG أو PNG أو WEBP'); e.status = 400; cb(e);
  }
});

const fileUrl = (file) => '/uploads/' + file.filename;

module.exports = { upload, fileUrl, UPLOAD_DIR };
