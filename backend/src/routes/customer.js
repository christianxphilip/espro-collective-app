import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import Collectible from '../models/Collectible.js';
import Promotion from '../models/Promotion.js';
import PointsTransaction from '../models/PointsTransaction.js';
import ReferralCode from '../models/ReferralCode.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/customer/profile
// @desc    Get customer profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'activeCardDesign',
        select: 'name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl',
      })
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
    const user = await User.findById(req.user._id).populate('referralCodes.referralCode');
    
    // Get all referral codes and their assigned rewards
    const allReferralCodes = await ReferralCode.find({ isActive: true })
      .select('assignedReward')
      .populate('assignedReward');
    
    // Build a map of reward IDs that are assigned to referral codes
    const rewardToReferralMap = new Map();
    allReferralCodes.forEach(refCode => {
      if (refCode.assignedReward) {
        rewardToReferralMap.set(refCode.assignedReward._id.toString(), refCode._id.toString());
      }
    });
    
    // Get rewards that user has access to via their referral codes
    const userReferralRewardIds = new Set();
    if (user.referralCodes && user.referralCodes.length > 0) {
      user.referralCodes.forEach(ref => {
        if (ref.referralCode && ref.referralCode.assignedReward) {
          userReferralRewardIds.add(ref.referralCode.assignedReward.toString());
        }
      });
    }
    
    // Get all active rewards
    const allRewards = await Reward.find({ isActive: true })
      .select('-voucherCodes -voucherCode') // Exclude voucher codes for security
      .populate({
        path: 'cardDesignIds',
        select: 'name description imageUrl designType gradientColors solidColor textColor',
      })
      .sort({ esproCoinsRequired: 1 });

    // Filter rewards: exclude rewards assigned to referral codes UNLESS user has that referral code
    const filteredRewards = allRewards.filter(reward => {
      const rewardId = reward._id.toString();
      const isAssignedToReferral = rewardToReferralMap.has(rewardId);
      
      if (isAssignedToReferral) {
        // Only include if user has the referral code for this reward
        return userReferralRewardIds.has(rewardId);
      }
      
      // Include all rewards not assigned to referral codes
      return true;
    });

    // Add available count for rewards with voucher codes (without exposing the codes)
    const rewardsWithCount = await Promise.all(filteredRewards.map(async (reward) => {
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
      
      // Check if available via referral
      const isAvailableViaReferral = userReferralRewardIds.has(reward._id.toString());
      rewardObj.isAvailableViaReferral = isAvailableViaReferral;
      
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
    const user = await User.findById(req.user._id).populate('referralCodes.referralCode');
    
    // Get all referral codes and their assigned card designs
    const allReferralCodes = await ReferralCode.find({ isActive: true })
      .select('assignedCardDesign')
      .populate('assignedCardDesign');
    
    // Build a map of card design IDs that are assigned to referral codes
    const cardDesignToReferralMap = new Map();
    allReferralCodes.forEach(refCode => {
      if (refCode.assignedCardDesign) {
        cardDesignToReferralMap.set(refCode.assignedCardDesign._id.toString(), refCode._id.toString());
      }
    });
    
    // Get card designs that user has access to via their referral codes
    const userReferralCardDesignIds = new Set();
    if (user.referralCodes && user.referralCodes.length > 0) {
      user.referralCodes.forEach(ref => {
        if (ref.referralCode && ref.referralCode.assignedCardDesign) {
          userReferralCardDesignIds.add(ref.referralCode.assignedCardDesign.toString());
        }
      });
    }
    
    // Get all active collectibles
    const allCollectibles = await Collectible.find({ isActive: true }).sort({ lifetimeEsproCoinsRequired: 1 });

    // Get user's unlocked collectibles (from unlockedCollectibles array)
    const userUnlockedCollectibles = user.unlockedCollectibles || [];
    
    // Filter collectibles: exclude card designs assigned to referral codes UNLESS user has that referral code
    const filteredCollectibles = allCollectibles.filter(collectible => {
      const collectibleId = collectible._id.toString();
      const isAssignedToReferral = cardDesignToReferralMap.has(collectibleId);
      
      if (isAssignedToReferral) {
        // Only include if user has the referral code for this card design
        return userReferralCardDesignIds.has(collectibleId);
      }
      
      // Include all card designs not assigned to referral codes
      return true;
    });

    // Add unlocked status for each collectible
    const collectiblesWithStatus = filteredCollectibles.map(collectible => {
      let isUnlocked = false;
      
      if (collectible.designType === 'reward') {
        // For reward-type designs, check if user has unlocked it via claims
        isUnlocked = userUnlockedCollectibles.some(id => id.toString() === collectible._id.toString());
      } else {
        // For regular designs, check lifetime coins
        isUnlocked = user.lifetimeEsproCoins >= collectible.lifetimeEsproCoinsRequired;
      }
      
      // Also check if available via referral code
      const isAvailableViaReferral = userReferralCardDesignIds.has(collectible._id.toString());
      // If available via referral, mark as unlocked (available to activate)
      if (isAvailableViaReferral) {
        isUnlocked = true;
      }

      return {
        ...collectible.toObject(),
        isUnlocked,
        isAvailableViaReferral,
      };
    });

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
    let isUnlocked = false;
    if (collectible.designType === 'reward') {
      // For reward-type designs, check unlockedCollectibles array
      const userUnlockedCollectibles = user.unlockedCollectibles || [];
      isUnlocked = userUnlockedCollectibles.some(id => id.toString() === collectible._id.toString());
    } else {
      // For regular designs, check lifetime coins
      isUnlocked = user.lifetimeEsproCoins >= collectible.lifetimeEsproCoinsRequired;
    }

    if (!isUnlocked) {
      return res.status(403).json({
        success: false,
        message: 'You have not unlocked this card design yet',
      });
    }

    // Activate the design
    user.activeCardDesign = collectible._id;
    await user.save();

    // Return user with fully populated activeCardDesign
    const updatedUser = await User.findById(user._id)
      .populate({
        path: 'activeCardDesign',
        select: 'name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl',
      })
      .select('-password');

    res.json({
      success: true,
      message: 'Card design activated',
      user: updatedUser,
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

    // Filter out card design rewards - only include rewards with voucher codes
    const vouchers = claims
      .filter(claim => {
        // Only include claims that have a voucherCode (not card design rewards)
        // Card design rewards have awardedCardDesign instead of voucherCode
        return claim.voucherCode !== null && claim.voucherCode !== undefined;
      })
      .map(claim => ({
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

