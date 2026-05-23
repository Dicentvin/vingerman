import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryStorageEngine {
  constructor(options = {}) { this.options = options; }

  _handleFile(req, file, cb) {
    const folder       = this.options.folder        || 'deutsch-studio/uploads';
    const resourceType = this.options.resource_type || 'raw';

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, use_filename: true, unique_filename: true },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path:     result.secure_url,
          filename: result.public_id,
          size:     result.bytes,
          format:   result.format,
          publicId: result.public_id,
        });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader
      .destroy(file.filename, { resource_type: this.options.resource_type || 'raw' })
      .then(() => cb(null))
      .catch(cb);
  }
}

const materialStorage = new CloudinaryStorageEngine({
  folder: 'deutsch-studio/materials',
  resource_type: 'raw',
});

const audioStorage = new CloudinaryStorageEngine({
  folder: 'deutsch-studio/recordings',
  resource_type: 'video',
});

const materialFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExts = /\.(pdf|pptx|txt|docx)$/i;
  if (allowedMimes.includes(file.mimetype) || allowedExts.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, PPTX, DOCX, and TXT files are allowed'), false);
  }
};

export const uploadMaterial = multer({
  storage: materialStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: materialFilter,
});

export const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export { cloudinary };
