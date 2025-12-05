import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import Collectible from '../models/Collectible.js';
import Promotion from '../models/Promotion.js';
import PointsTransaction from '../models/PointsTransaction.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/customer/profile
// @desc    Get customer profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('activeCardDesign')
      .select('-password');

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/customer/profile
// @desc    Update customer profile
// @access  Private
router.put('/profile', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/customer/rewards
// @desc    Get available rewards (voucher codes excluded for security)
// @access  Private
router.get('/rewards', async (req, res) => {
  try {
    const rewards = await Reward.find({ isActive: true })
      .select('-voucherCodes -voucherCode') // Exclude voucher codes for security
      .sort({ esproCoinsRequired: 1 });

    // Add available count for rewards with voucher codes (without exposing the codes)
    const rewardsWithCount = await Promise.all(rewards.map(async (reward) => {
      const rewardObj = reward.toObject();
      
      // Get the full reward to check voucher codes count (but don't expose codes)
      const fullReward = await Reward.findById(reward._id);
      if (fullReward && fullReward.voucherCodes && fullReward.voucherCodes.length > 0) {
        const availableCount = fullReward.voucherCodes.filter(v => !v.isUsed).length;
        rewardObj.availableVoucherCount = availableCount;
        rewardObj.hasVoucherCodes = true;
      } else {
        rewardObj.availableVoucherCount = reward.quantity === -1 ? -1 : reward.quantity;
        rewardObj.hasVoucherCodes = false;
      }
      
      return rewardObj;
    }));

    res.json({
      success: true,
      rewards: rewardsWithCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/customer/collectibles
// @desc    Get all card designs (collectibles)
// @access  Private
router.get('/collectibles', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const collectibles = await Collectible.find({ isActive: true }).sort({ lifetimeEsproCoinsRequired: 1 });

    // Add unlocked status for each collectible
    const collectiblesWithStatus = collectibles.map(collectible => ({
      ...collectible.toObject(),
      isUnlocked: user.lifetimeEsproCoins >= collectible.lifetimeEsproCoinsRequired,
    }));

    res.json({
      success: true,
      collectibles: collectiblesWithStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/customer/collectibles/:id/activate
// @desc    Activate a card design
// @access  Private
router.put('/collectibles/:id/activate', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const collectible = await Collectible.findById(req.params.id);

    if (!collectible) {
      return res.status(404).json({
        success: false,
        message: 'Card design not found',
      });
    }

    // Check if user has unlocked this design
    if (user.lifetimeEsproCoins < collectible.lifetimeEsproCoinsRequired) {
      return res.status(403).json({
        success: false,
        message: 'You have not unlocked this card design yet',
      });
    }

    // Activate the design
    user.activeCardDesign = collectible._id;
    await user.save();

    res.json({
      success: true,
      message: 'Card design activated',
      user: await User.findById(user._id).populate('activeCardDesign'),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/customer/promotions
// @desc    Get active promotions
// @access  Private
router.get('/promotions', async (req, res) => {
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

// @route   GET /api/customer/claims
// @desc    Get claim history - voucher codes excluded from reward for security
// @access  Private
router.get('/claims', async (req, res) => {
  try {
    const claims = await Claim.find({ user: req.user._id })
      .populate({
        path: 'reward',
        select: '-voucherCodes -voucherCode', // Exclude unused voucher codes for security
      })
      .sort({ claimedAt: -1 });

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

// @route   GET /api/customer/vouchers
// @desc    Get user's vouchers (available and used) - voucher codes excluded from reward for security
// @access  Private
router.get('/vouchers', async (req, res) => {
  try {
    const claims = await Claim.find({ user: req.user._id })
      .populate({
        path: 'reward',
        select: '-voucherCodes -voucherCode', // Exclude unused voucher codes for security
      })
      .sort({ claimedAt: -1 });

    const vouchers = claims.map(claim => ({
      _id: claim._id,
      reward: claim.reward,
      voucherCode: claim.voucherCode, // Only return the voucher code that belongs to this user
      esproCoinsDeducted: claim.esproCoinsDeducted,
      isUsed: claim.isUsed || false,
      usedAt: claim.usedAt,
      claimedAt: claim.claimedAt,
    }));

    const available = vouchers.filter(v => !v.isUsed);
    const used = vouchers.filter(v => v.isUsed);

    res.json({
      success: true,
      vouchers: {
        available,
        used,
        total: vouchers.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/customer/points-history
// @desc    Get user's points transaction history
// @access  Private
router.get('/points-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const transactions = await PointsTransaction.find({ user: req.user._id })
      .populate({
        path: 'referenceId',
        select: 'title name',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PointsTransaction.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      transactions,
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

