/**
 * File upload middleware configuration
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = config.upload.allowedFileTypes;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
  },
});

export default upload;
