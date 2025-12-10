import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import Claim from '../models/Claim.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/claims
// @desc    Get user's claim history
// @access  Private
router.get('/', async (req, res) => {
  try {
    const claims = await Claim.find({ user: req.user._id })
      .select('_id voucherCode esproCoinsDeducted isUsed usedAt claimedAt awardedCardDesign reward')
      .populate('reward', 'title imageUrl esproCoinsRequired')
      .populate('awardedCardDesign', 'name imageUrl designType')
      .sort({ claimedAt: -1 })
      .lean();

    res.json({
      success: true,
      claims,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/claims/:id
// @desc    Get a specific claim
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('reward');

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found',
      });
    }

    // Check if user owns this claim
    if (claim.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    res.json({
      success: true,
      claim,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Admin routes
router.use(requireAdmin);

// @route   GET /api/claims/admin/all
// @desc    Get all claims (admin) with pagination
// @access  Private/Admin
router.get('/admin/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const claims = await Claim.find()
      .select('_id voucherCode esproCoinsDeducted isUsed usedAt claimedAt reward user awardedCardDesign')
      .populate('reward', 'title imageUrl esproCoinsRequired')
      .populate('user', 'name email loyaltyId')
      .populate('awardedCardDesign', 'name imageUrl designType')
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Claim.countDocuments();

    res.json({
      success: true,
      claims,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

