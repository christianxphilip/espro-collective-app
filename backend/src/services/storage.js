import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize S3 if credentials are provided
let s3Client = null;
let useS3 = false;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  useS3 = true;
  console.log('[Storage] Using AWS S3 for file storage');
} else {
  console.log('[Storage] Using local filesystem for file storage (S3 not configured)');
}

/**
 * Get multer storage configuration for a specific upload type
 * @param {string} uploadType - 'collectibles', 'rewards', 'promotions', 'settings'
 * @returns {multer.StorageEngine} Multer storage engine
 */
export function getStorage(uploadType) {
  if (useS3 && s3Client) {
    // Use S3 storage
    return multerS3({
      s3: s3Client,
      bucket: process.env.AWS_S3_BUCKET,
      acl: 'public-read', // Make files publicly accessible
      key: function (req, file, cb) {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `${uploadType}/${uploadType}-${uniqueSuffix}${ext}`;
        cb(null, filename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    });
  } else {
    // Use local filesystem storage
    const uploadDir = path.join(__dirname, '../../uploads', uploadType);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uploadType}-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    });
  }
}

/**
 * Get the public URL for an uploaded file
 * @param {string} filePath - The file path from multer (either S3 key or local path)
 * @param {string} uploadType - The upload type
 * @returns {string} Public URL to access the file
 */
export function getFileUrl(filePath, uploadType) {
  if (!filePath) return null;
  
  if (useS3 && s3Client && filePath) {
    // If filePath is already a full URL, return it
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    
    // Construct S3 public URL
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    
    // S3 URL format: https://bucket-name.s3.region.amazonaws.com/key
    // Or for some regions: https://bucket-name.s3-region.amazonaws.com/key
    // Use the standard format
    if (region === 'us-east-1') {
      // us-east-1 doesn't include region in URL
      return `https://${bucket}.s3.amazonaws.com/${filePath}`;
    } else {
      return `https://${bucket}.s3.${region}.amazonaws.com/${filePath}`;
    }
  } else {
    // Local filesystem - return relative path
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    
    // If it's already in the correct format, return as is
    if (filePath.startsWith('/uploads/')) {
      return filePath;
    }
    
    // Otherwise, construct the path
    // Handle both cases: just filename or full path
    const filename = path.basename(filePath);
    return `/uploads/${uploadType}/${filename}`;
  }
}

/**
 * Delete a file from storage
 * @param {string} filePath - The file path or S3 key
 * @param {string} uploadType - The upload type
 * @returns {Promise<void>}
 */
export async function deleteFile(filePath, uploadType) {
  if (!filePath) return;
  
  if (useS3 && s3Client && filePath) {
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      
      // Extract S3 key from URL if it's a full URL
      let key = filePath;
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        const url = new URL(filePath);
        // Remove leading slash and bucket name from path
        key = url.pathname.substring(1);
        // If path starts with bucket name, remove it
        if (key.startsWith(process.env.AWS_S3_BUCKET + '/')) {
          key = key.substring(process.env.AWS_S3_BUCKET.length + 1);
        }
      }
      
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      });
      
      await s3Client.send(command);
      console.log('[Storage] Deleted file from S3:', key);
    } catch (error) {
      console.error('[Storage] Error deleting file from S3:', error);
      throw error;
    }
  } else {
    // Local filesystem
    try {
      const filePathFull = path.join(__dirname, '../../uploads', uploadType, path.basename(filePath));
      if (fs.existsSync(filePathFull)) {
        fs.unlinkSync(filePathFull);
        console.log('[Storage] Deleted local file:', filePathFull);
      }
    } catch (error) {
      console.error('[Storage] Error deleting local file:', error);
      throw error;
    }
  }
}

/**
 * Check if S3 is configured and being used
 * @returns {boolean}
 */
export function isUsingS3() {
  return useS3;
}

