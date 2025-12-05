import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import Collectible from '../models/Collectible.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Card dimensions constants
const CARD_WIDTH = 856;
const CARD_HEIGHT = 540;

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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/collectibles'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'collectible-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
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
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, lifetimeEsproCoinsRequired, designType, primaryColor, secondaryColor, solidColor, isDefault, imageUrl, textColor } = req.body;

    const collectibleData = {
      name,
      description,
      lifetimeEsproCoinsRequired: parseInt(lifetimeEsproCoinsRequired) || 0,
      designType: designType || 'gradient',
      createdBy: req.user._id,
      isDefault: isDefault === 'true' || isDefault === true,
      textColor: textColor || '#FFFFFF',
    };

    // Handle uploaded file
    if (req.file) {
      const originalPath = req.file.path;
      const resizedPath = path.join(__dirname, '../../uploads/collectibles', `resized-${req.file.filename}`);
      
      // Resize image to card dimensions
      const resizeSuccess = await resizeImageToCardDimensions(originalPath, resizedPath);
      
      if (resizeSuccess) {
        // Delete original and use resized version
        fs.unlinkSync(originalPath);
        collectibleData.imageUrl = `/uploads/collectibles/resized-${req.file.filename}`;
      } else {
        // If resize fails, use original (but warn)
        collectibleData.imageUrl = `/uploads/collectibles/${req.file.filename}`;
      }
      
      collectibleData.designType = 'image';
      collectibleData.isAIGenerated = false;
    } 
    // Handle AI-generated image URL (from body)
    else if (imageUrl && designType === 'image') {
      collectibleData.imageUrl = imageUrl;
      collectibleData.designType = 'image';
      collectibleData.isAIGenerated = true;
    } 
    // Handle gradient colors
    else if (designType === 'gradient' && primaryColor && secondaryColor) {
      collectibleData.gradientColors = {
        primary: primaryColor,
        secondary: secondaryColor,
      };
      collectibleData.isAIGenerated = false;
    }
    // Handle solid color
    else if (designType === 'solid' && (primaryColor || solidColor)) {
      collectibleData.solidColor = primaryColor || solidColor;
      collectibleData.isAIGenerated = false;
    }
    // Handle solid color
    else if (designType === 'solid' && primaryColor) {
      collectibleData.solidColor = primaryColor;
      collectibleData.isAIGenerated = false;
    }

    // If this is set as default, unset other defaults
    if (collectibleData.isDefault) {
      await Collectible.updateMany({ isDefault: true }, { isDefault: false });
    }

    const collectible = await Collectible.create(collectibleData);

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
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const collectible = await Collectible.findById(req.params.id);
    if (!collectible) {
      return res.status(404).json({
        success: false,
        message: 'Card design not found',
      });
    }

    const { name, description, lifetimeEsproCoinsRequired, designType, primaryColor, secondaryColor, solidColor, isActive, isDefault, imageUrl, textColor } = req.body;

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

    // Handle uploaded file
    if (req.file) {
      const originalPath = req.file.path;
      const resizedPath = path.join(__dirname, '../../uploads/collectibles', `resized-${req.file.filename}`);
      
      // Resize image to card dimensions
      const resizeSuccess = await resizeImageToCardDimensions(originalPath, resizedPath);
      
      if (resizeSuccess) {
        // Delete original and use resized version
        fs.unlinkSync(originalPath);
        collectible.imageUrl = `/uploads/collectibles/resized-${req.file.filename}`;
      } else {
        // If resize fails, use original (but warn)
        collectible.imageUrl = `/uploads/collectibles/${req.file.filename}`;
      }
      
      collectible.designType = 'image';
      collectible.isAIGenerated = false;
    } 
    // Handle AI-generated image URL (from body)
    else if (imageUrl && designType === 'image') {
      collectible.imageUrl = imageUrl;
      collectible.designType = 'image';
      collectible.isAIGenerated = true;
    } 
    // Handle gradient colors
    else if (designType === 'gradient' && primaryColor && secondaryColor) {
      collectible.gradientColors = {
        primary: primaryColor,
        secondary: secondaryColor,
      };
      collectible.isAIGenerated = false;
    }
    // Handle solid color
    else if (designType === 'solid' && (primaryColor || solidColor)) {
      collectible.solidColor = primaryColor || solidColor;
      collectible.isAIGenerated = false;
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

