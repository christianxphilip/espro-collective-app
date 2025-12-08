import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import Collectible from '../models/Collectible.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs';
import { getStorage, getFileUrl, deleteFile, isUsingS3 } from '../services/storage.js';
import { S3Client } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize S3 client if credentials are available (for image processing)
let s3Client = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

const router = express.Router();

// Card dimensions constants
const CARD_WIDTH = 428;
const CARD_HEIGHT = 380;
// Mobile card dimensions (for smaller screens like iPhone 14)
const MOBILE_CARD_WIDTH = 340; // Smaller width for mobile screens
const MOBILE_CARD_HEIGHT = 300; // Smaller height for mobile screens

// Helper function to resize image to card dimensions
async function resizeImageToCardDimensions(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover', // Cover the entire area, may crop
        position: 'center',
      })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Error resizing image:', error);
    return false;
  }
}

// Helper function to process uploaded image (handles both S3 and local storage)
async function processUploadedImage(file, uploadType = 'collectibles', prefix = '') {
  const fileExt = path.extname(file.originalname).toLowerCase();
  const isSvg = fileExt === '.svg';
  
  // Get file info based on storage type
  const isS3 = !!file.location; // S3 provides location property
  const fileKey = file.key || file.filename; // S3 key or local filename
  const originalUrl = file.location || getFileUrl(file.path || fileKey, uploadType);
  
  if (isSvg) {
    // SVG files don't need resizing
    return {
      imageUrl: originalUrl,
      needsResize: false,
    };
  }
  
  // For S3, we need to download, resize, and upload back
  if (isS3) {
    try {
      const { GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const axios = (await import('axios')).default;
      
      // Download image from S3
      const getCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
      });
      
      const response = await s3Client.send(getCommand);
      const imageBuffer = await streamToBuffer(response.Body);
      
      // Resize image
      const resizedBuffer = await sharp(imageBuffer)
        .resize(CARD_WIDTH, CARD_HEIGHT, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();
      
      // Upload resized image back to S3
      const resizedKey = `${uploadType}/${prefix}resized-${path.basename(fileKey)}`;
      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: resizedKey,
        Body: resizedBuffer,
        ContentType: file.mimetype || 'image/png',
        // ACL removed - bucket policy handles public access
      });
      
      await s3Client.send(putCommand);
      
      // Delete original from S3
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
      });
      await s3Client.send(deleteCommand);
      
      // Return resized image URL
      return {
        imageUrl: getFileUrl(resizedKey, uploadType),
        needsResize: false,
      };
    } catch (error) {
      console.error('[Collectibles] Error processing S3 image:', error);
      return {
        imageUrl: originalUrl,
        needsResize: false,
      };
    }
  } else {
    // Local storage - use existing resize logic
    const originalPath = file.path;
    const resizedPath = path.join(__dirname, '../../uploads', uploadType, `${prefix}resized-${file.filename}`);
    const resizeSuccess = await resizeImageToCardDimensions(originalPath, resizedPath);
    
    if (resizeSuccess) {
      // Delete original and use resized version
      fs.unlinkSync(originalPath);
      return {
        imageUrl: getFileUrl(`resized-${file.filename}`, uploadType),
        needsResize: false,
      };
    } else {
      return {
        imageUrl: getFileUrl(file.filename, uploadType),
        needsResize: false,
      };
    }
  }
}

// Helper function to process mobile image (similar to processUploadedImage but with mobile dimensions)
async function processMobileImage(file, uploadType = 'collectibles', prefix = 'mobile-') {
  const fileExt = path.extname(file.originalname).toLowerCase();
  const isSvg = fileExt === '.svg';
  
  const isS3 = !!file.location;
  const fileKey = file.key || file.filename;
  const originalUrl = file.location || getFileUrl(file.path || fileKey, uploadType);
  
  if (isSvg) {
    return { imageUrl: originalUrl, needsResize: false };
  }
  
  if (isS3) {
    try {
      const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      
      const getCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
      });
      const response = await s3Client.send(getCommand);
      const imageBuffer = await streamToBuffer(response.Body);
      
      const resizedBuffer = await sharp(imageBuffer)
        .resize(MOBILE_CARD_WIDTH, MOBILE_CARD_HEIGHT, { fit: 'cover', position: 'center' })
        .toBuffer();
      
      const resizedKey = `${uploadType}/${prefix}resized-${path.basename(fileKey)}`;
      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: resizedKey,
        Body: resizedBuffer,
        ContentType: file.mimetype || 'image/png',
      });
      await s3Client.send(putCommand);
      
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
      });
      await s3Client.send(deleteCommand);
      
      return { imageUrl: getFileUrl(resizedKey, uploadType), needsResize: false };
    } catch (error) {
      console.error('[Collectibles] Error processing S3 mobile image:', error);
      return { imageUrl: originalUrl, needsResize: false };
    }
  } else {
    const originalPath = file.path;
    const resizedPath = path.join(__dirname, '../../uploads', uploadType, `${prefix}resized-${file.filename}`);
    
    try {
      await sharp(originalPath)
        .resize(MOBILE_CARD_WIDTH, MOBILE_CARD_HEIGHT, { fit: 'cover', position: 'center' })
        .toFile(resizedPath);
      fs.unlinkSync(originalPath);
      return { imageUrl: getFileUrl(`${prefix}resized-${file.filename}`, uploadType), needsResize: false };
    } catch (error) {
      console.error('[Collectibles] Error resizing mobile image:', error);
      return { imageUrl: getFileUrl(file.filename, uploadType), needsResize: false };
    }
  }
}

// Helper to convert stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Configure multer for file uploads using storage service
const upload = multer({
  storage: getStorage('collectibles'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed'));
    }
  },
});

// Public route - get all collectibles (for customer portal)
router.get('/', protect, async (req, res) => {
  try {
    const collectibles = await Collectible.find({ isActive: true }).sort({ lifetimeEsproCoinsRequired: 1 });
    res.json({
      success: true,
      collectibles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Admin routes
router.use(protect, requireAdmin);

// @route   GET /api/collectibles/admin
// @desc    Get all collectibles (admin)
// @access  Private/Admin
router.get('/admin', async (req, res) => {
  try {
    const collectibles = await Collectible.find().sort({ lifetimeEsproCoinsRequired: 1 });
    res.json({
      success: true,
      collectibles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/collectibles
// @desc    Create a new card design (collectible)
// @access  Private/Admin
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 },
  { name: 'backCardImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, lifetimeEsproCoinsRequired, designType, primaryColor, secondaryColor, solidColor, isDefault, imageUrl, mobileImageUrl, textColor, backCardColor, backCardImageUrl } = req.body;

    const collectibleData = {
      name,
      description,
      lifetimeEsproCoinsRequired: parseInt(lifetimeEsproCoinsRequired) || 0,
      designType: designType || 'gradient',
      createdBy: req.user._id,
      isDefault: isDefault === 'true' || isDefault === true,
      textColor: textColor || '#FFFFFF',
      backCardColor: backCardColor && backCardColor.trim() !== '' ? backCardColor : null,
    };

    // Handle front card image upload
    if (req.files && req.files.image && req.files.image[0]) {
      console.log('[Collectibles] Processing image upload:', {
        designType,
        filename: req.files.image[0].filename,
        originalname: req.files.image[0].originalname
      });
      
      const file = req.files.image[0];
      const processed = await processUploadedImage(file, 'collectibles');
      collectibleData.imageUrl = processed.imageUrl;
      console.log('[Collectibles] Image processed:', {
        imageUrl: collectibleData.imageUrl,
        isS3: !!file.location,
      });
      
      // Only override designType to 'image' if it wasn't explicitly set to 'reward' or 'solid'
      // Reward type can have images but should stay as 'reward'
      if (designType && designType !== 'reward' && designType !== 'solid') {
        // If designType was gradient or not set, change to image
        if (!designType || designType === 'gradient') {
          collectibleData.designType = 'image';
        }
      } else if (!designType) {
        // If no designType was specified, set to image
        collectibleData.designType = 'image';
      }
      collectibleData.isAIGenerated = false;
      console.log('[Collectibles] Image processed, designType:', collectibleData.designType);
    } else {
      console.log('[Collectibles] No image file in request:', {
        hasFiles: !!req.files,
        hasImage: !!(req.files && req.files.image),
        designType
      });
    }
    
    // Handle mobile image upload (for small screens)
    if (req.files && req.files.mobileImage && req.files.mobileImage[0]) {
      const file = req.files.mobileImage[0];
      const processed = await processMobileImage(file, 'collectibles');
      collectibleData.mobileImageUrl = processed.imageUrl;
      console.log('[Collectibles] Mobile image processed:', {
        mobileImageUrl: collectibleData.mobileImageUrl,
        isS3: !!file.location,
      });
    } else if (mobileImageUrl) {
      // Handle AI-generated or existing mobile image URL
      collectibleData.mobileImageUrl = mobileImageUrl;
    }
    
    // Handle back card image upload
    if (req.files && req.files.backCardImage && req.files.backCardImage[0]) {
      const file = req.files.backCardImage[0];
      const processed = await processUploadedImage(file, 'collectibles', 'back-');
      collectibleData.backCardImageUrl = processed.imageUrl;
      console.log('[Collectibles] Back card image processed:', {
        imageUrl: collectibleData.backCardImageUrl,
        isS3: !!file.location,
      });
    } else if (backCardImageUrl) {
      // Handle AI-generated or existing back card image URL
      collectibleData.backCardImageUrl = backCardImageUrl;
    } 
    // Handle AI-generated image URL (from body)
    // Allow AI images for both 'image' and 'reward' types
    if (imageUrl && (designType === 'image' || designType === 'reward')) {
      collectibleData.imageUrl = imageUrl;
      // Only change designType to 'image' if it wasn't explicitly set
      if (!designType || (designType !== 'reward' && designType !== 'solid')) {
        if (designType === 'gradient' || !designType) {
          collectibleData.designType = 'image';
        }
      }
      collectibleData.isAIGenerated = true;
    } 
    // Handle gradient colors (for gradient and reward types)
    if ((designType === 'gradient' || designType === 'reward') && primaryColor && secondaryColor) {
      collectibleData.gradientColors = {
        primary: primaryColor,
        secondary: secondaryColor,
      };
      collectibleData.isAIGenerated = false;
    }
    // Handle solid color
    if (designType === 'solid' && (primaryColor || solidColor)) {
      collectibleData.solidColor = primaryColor || solidColor;
      collectibleData.isAIGenerated = false;
    }
    
    // For reward type, ensure lifetimeEsproCoinsRequired is 0 (not required)
    if (designType === 'reward') {
      collectibleData.lifetimeEsproCoinsRequired = 0;
    }

    console.log('[Collectibles] Final collectibleData before save:', {
      name: collectibleData.name,
      designType: collectibleData.designType,
      hasImageUrl: !!collectibleData.imageUrl,
      imageUrl: collectibleData.imageUrl,
      hasGradientColors: !!collectibleData.gradientColors,
      lifetimeEsproCoinsRequired: collectibleData.lifetimeEsproCoinsRequired
    });

    // If this is set as default, unset other defaults
    if (collectibleData.isDefault) {
      await Collectible.updateMany({ isDefault: true }, { isDefault: false });
    }

    const collectible = await Collectible.create(collectibleData);
    
    console.log('[Collectibles] Collectible created:', {
      _id: collectible._id,
      name: collectible.name,
      designType: collectible.designType,
      imageUrl: collectible.imageUrl
    });

    res.status(201).json({
      success: true,
      collectible,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/collectibles/:id
// @desc    Update a card design
// @access  Private/Admin
router.put('/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 },
  { name: 'backCardImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const collectible = await Collectible.findById(req.params.id);
    if (!collectible) {
      return res.status(404).json({
        success: false,
        message: 'Card design not found',
      });
    }

    const { name, description, lifetimeEsproCoinsRequired, designType, primaryColor, secondaryColor, solidColor, isActive, isDefault, imageUrl, mobileImageUrl, textColor, backCardColor, backCardImageUrl } = req.body;

    if (name) collectible.name = name;
    if (description !== undefined) collectible.description = description;
    if (lifetimeEsproCoinsRequired) collectible.lifetimeEsproCoinsRequired = parseInt(lifetimeEsproCoinsRequired);
    if (designType) collectible.designType = designType;
    if (isActive !== undefined) collectible.isActive = isActive === 'true' || isActive === true;
    if (isDefault !== undefined) {
      const newDefault = isDefault === 'true' || isDefault === true;
      if (newDefault) {
        await Collectible.updateMany({ isDefault: true }, { isDefault: false });
      }
      collectible.isDefault = newDefault;
    }
    if (textColor) collectible.textColor = textColor;
    
    // Always handle backCardColor if it's in the request body (FormData always sends it)
    // Check if the field exists in the request (even if empty string)
    if ('backCardColor' in req.body) {
      // If empty string or whitespace, clear it; otherwise set the value
      const trimmedColor = typeof backCardColor === 'string' ? backCardColor.trim() : '';
      collectible.backCardColor = trimmedColor !== '' ? trimmedColor : null;
      console.log('[Collectibles Update] backCardColor:', { 
        received: backCardColor, 
        trimmed: trimmedColor, 
        setting: collectible.backCardColor 
      });
    }

    // Handle front card image upload
    if (req.files && req.files.image && req.files.image[0]) {
      const file = req.files.image[0];
      const processed = await processUploadedImage(file, 'collectibles');
      collectible.imageUrl = processed.imageUrl;
      console.log('[Collectibles] Image updated:', {
        imageUrl: collectible.imageUrl,
        isS3: !!file.location,
      });
      
      // Only override designType to 'image' if it wasn't explicitly set to something else
      if (!designType || designType === 'gradient' || designType === 'solid') {
        collectible.designType = 'image';
      }
      collectible.isAIGenerated = false;
    } 
    // Handle AI-generated image URL (from body)
    if (imageUrl && designType === 'image') {
      collectible.imageUrl = imageUrl;
      if (!designType || designType === 'gradient' || designType === 'solid') {
        collectible.designType = 'image';
      }
      collectible.isAIGenerated = true;
    }
    
    // Handle mobile image upload (for small screens)
    if (req.files && req.files.mobileImage && req.files.mobileImage[0]) {
      const file = req.files.mobileImage[0];
      // Delete old mobile image if it exists
      if (collectible.mobileImageUrl && !collectible.mobileImageUrl.startsWith('http')) {
        await deleteFile(collectible.mobileImageUrl, 'collectibles');
      }
      const processed = await processMobileImage(file, 'collectibles');
      collectible.mobileImageUrl = processed.imageUrl;
      console.log('[Collectibles] Mobile image updated:', {
        mobileImageUrl: collectible.mobileImageUrl,
        isS3: !!file.location,
      });
    } else if (mobileImageUrl !== undefined) {
      // Handle AI-generated or existing mobile image URL, or clearing it
      if (mobileImageUrl && mobileImageUrl.trim() !== '') {
        collectible.mobileImageUrl = mobileImageUrl;
      } else if (mobileImageUrl === '' || mobileImageUrl === null) {
        // Clear mobile image if explicitly set to empty
        if (collectible.mobileImageUrl && !collectible.mobileImageUrl.startsWith('http')) {
          await deleteFile(collectible.mobileImageUrl, 'collectibles');
        }
        collectible.mobileImageUrl = null;
      }
    }
    
    // Handle gradient colors (for gradient and reward types)
    if ((designType === 'gradient' || designType === 'reward') && primaryColor && secondaryColor) {
      collectible.gradientColors = {
        primary: primaryColor,
        secondary: secondaryColor,
      };
      collectible.isAIGenerated = false;
    } 
    // Handle solid color
    if (designType === 'solid' && (primaryColor || solidColor)) {
      collectible.solidColor = primaryColor || solidColor;
      collectible.isAIGenerated = false;
    }
    
    // For reward type, ensure lifetimeEsproCoinsRequired is 0 (not required)
    if (designType === 'reward') {
      collectible.lifetimeEsproCoinsRequired = 0;
    }
    
    // Handle back card image upload
    if (req.files && req.files.backCardImage && req.files.backCardImage[0]) {
      const file = req.files.backCardImage[0];
      const originalPath = file.path;
      const fileExt = path.extname(file.originalname).toLowerCase();
      const isSvg = fileExt === '.svg';
      
      if (isSvg) {
        // SVG files don't need resizing (they're vector graphics)
        collectible.backCardImageUrl = `/uploads/collectibles/${file.filename}`;
      } else {
        // Resize raster images to card dimensions
        const resizedPath = path.join(__dirname, '../../uploads/collectibles', `resized-back-${file.filename}`);
        const resizeSuccess = await resizeImageToCardDimensions(originalPath, resizedPath);
        
        if (resizeSuccess) {
          // Delete original and use resized version
          fs.unlinkSync(originalPath);
          collectible.backCardImageUrl = `/uploads/collectibles/resized-back-${file.filename}`;
        } else {
          // If resize fails, use original (but warn)
          collectible.backCardImageUrl = `/uploads/collectibles/${file.filename}`;
        }
      }
    } else if (backCardImageUrl !== undefined) {
      // Handle AI-generated or existing back card image URL
      collectible.backCardImageUrl = backCardImageUrl || undefined;
    }

    await collectible.save();

    res.json({
      success: true,
      collectible,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/collectibles/:id
// @desc    Delete a card design
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    await Collectible.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Card design deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

