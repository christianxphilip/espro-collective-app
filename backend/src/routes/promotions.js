import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import Promotion from '../models/Promotion.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStorage, getFileUrl } from '../services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: getStorage('promotions'),
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

// Public route - get active promotions (for customer portal)
router.get('/', protect, async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { endDate: null },
      ],
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      promotions,
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

// @route   GET /api/promotions/admin
// @desc    Get all promotions (admin)
// @access  Private/Admin
router.get('/admin', async (req, res) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      promotions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/promotions
// @desc    Create a new promotion
// @access  Private/Admin
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, description, linkUrl, startDate, endDate } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Promotion image is required',
      });
    }

    const promotion = await Promotion.create({
      title,
      description,
      imageUrl: req.file.location || getFileUrl(req.file.filename, 'promotions'),
      linkUrl,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/promotions/:id
// @desc    Update a promotion
// @access  Private/Admin
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found',
      });
    }

    const { title, description, linkUrl, startDate, endDate, isActive } = req.body;

    if (title) promotion.title = title;
    if (description !== undefined) promotion.description = description;
    if (linkUrl !== undefined) promotion.linkUrl = linkUrl;
    if (startDate) promotion.startDate = new Date(startDate);
    if (endDate) promotion.endDate = new Date(endDate);
    if (isActive !== undefined) promotion.isActive = isActive === 'true' || isActive === true;

    if (req.file) {
      promotion.imageUrl = req.file.location || getFileUrl(req.file.filename, 'promotions');
    }

    await promotion.save();

    res.json({
      success: true,
      promotion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/promotions/:id
// @desc    Delete a promotion
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    await Promotion.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Promotion deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

