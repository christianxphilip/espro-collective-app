import express from 'express';
import ReferralCode from '../models/ReferralCode.js';
import User from '../models/User.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate referral code
function generateReferralCode(prefix = 'CLUB') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  const part2 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `${prefix}-${part1}-${part2}`;
}

// @route   GET /api/admin/referrals
// @desc    Get all referral codes with usage stats
// @access  Private/Admin
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const referrals = await ReferralCode.find()
      .populate('assignedCardDesign', 'name imageUrl designType')
      .populate('assignedReward', 'title imageUrl esproCoinsRequired')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      referrals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/referrals/:id
// @desc    Get single referral code with user list
// @access  Private/Admin
router.get('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const referral = await ReferralCode.findById(req.params.id)
      .populate('assignedCardDesign', 'name imageUrl designType')
      .populate('assignedReward', 'title imageUrl esproCoinsRequired')
      .populate('createdBy', 'name email')
      .populate('usedBy.user', 'name email loyaltyId');

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    res.json({
      success: true,
      referral,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/referrals/:id/users
// @desc    Get list of users who used this referral code
// @access  Private/Admin
router.get('/:id/users', protect, requireAdmin, async (req, res) => {
  try {
    const referral = await ReferralCode.findById(req.params.id)
      .populate('usedBy.user', 'name email loyaltyId createdAt');

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    res.json({
      success: true,
      users: referral.usedBy.map(entry => ({
        user: entry.user,
        usedAt: entry.usedAt,
      })),
      total: referral.usedBy.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/referrals
// @desc    Create new referral code
// @access  Private/Admin
router.post('/', protect, requireAdmin, async (req, res) => {
  try {
    const { code, name, description, assignedCardDesign, assignedReward, maxUses, isActive } = req.body;

    // Generate code if not provided
    let finalCode = code;
    if (!finalCode) {
      // Auto-generate code
      let generatedCode;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        generatedCode = generateReferralCode();
        const exists = await ReferralCode.findOne({ code: generatedCode });
        if (!exists) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (!isUnique) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate unique referral code. Please try again or provide a manual code.',
        });
      }
      
      finalCode = generatedCode;
    } else {
      // Normalize provided code
      finalCode = code.trim().toUpperCase();
      
      // Check if code already exists
      const exists = await ReferralCode.findOne({ code: finalCode });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: 'Referral code already exists',
        });
      }
    }

    // Validate assignedCardDesign and assignedReward if provided
    if (assignedCardDesign) {
      const Collectible = (await import('../models/Collectible.js')).default;
      const cardDesign = await Collectible.findById(assignedCardDesign);
      if (!cardDesign) {
        return res.status(400).json({
          success: false,
          message: 'Assigned card design not found',
        });
      }
    }

    if (assignedReward) {
      const Reward = (await import('../models/Reward.js')).default;
      const reward = await Reward.findById(assignedReward);
      if (!reward) {
        return res.status(400).json({
          success: false,
          message: 'Assigned reward not found',
        });
      }
    }

    const referral = await ReferralCode.create({
      code: finalCode,
      name,
      description,
      assignedCardDesign: assignedCardDesign || null,
      assignedReward: assignedReward || null,
      maxUses: maxUses !== undefined ? parseInt(maxUses) : -1,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    const populatedReferral = await ReferralCode.findById(referral._id)
      .populate('assignedCardDesign', 'name imageUrl designType')
      .populate('assignedReward', 'title imageUrl esproCoinsRequired');

    res.status(201).json({
      success: true,
      referral: populatedReferral,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/admin/referrals/:id
// @desc    Update referral code
// @access  Private/Admin
router.put('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const { name, description, assignedCardDesign, assignedReward, maxUses, isActive } = req.body;

    const referral = await ReferralCode.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    // Validate assignedCardDesign and assignedReward if provided
    if (assignedCardDesign) {
      const Collectible = (await import('../models/Collectible.js')).default;
      const cardDesign = await Collectible.findById(assignedCardDesign);
      if (!cardDesign) {
        return res.status(400).json({
          success: false,
          message: 'Assigned card design not found',
        });
      }
      referral.assignedCardDesign = assignedCardDesign;
    }

    if (assignedReward) {
      const Reward = (await import('../models/Reward.js')).default;
      const reward = await Reward.findById(assignedReward);
      if (!reward) {
        return res.status(400).json({
          success: false,
          message: 'Assigned reward not found',
        });
      }
      referral.assignedReward = assignedReward;
    }

    if (name !== undefined) referral.name = name;
    if (description !== undefined) referral.description = description;
    if (maxUses !== undefined) referral.maxUses = parseInt(maxUses);
    if (isActive !== undefined) referral.isActive = isActive;

    await referral.save();

    const populatedReferral = await ReferralCode.findById(referral._id)
      .populate('assignedCardDesign', 'name imageUrl designType')
      .populate('assignedReward', 'title imageUrl esproCoinsRequired')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      referral: populatedReferral,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/referrals/:id/add-user
// @desc    Manually add a user to a referral code
// @access  Private/Admin
router.post('/:id/add-user', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const referralId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Find referral code
    const referral = await ReferralCode.findById(referralId);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    if (!referral.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add users to inactive referral code',
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user already has this referral code
    const alreadyHasReferral = user.referralCodes.some(
      ref => ref.referralCode && ref.referralCode.toString() === referralId
    );

    if (alreadyHasReferral) {
      return res.status(400).json({
        success: false,
        message: 'User already has this referral code',
      });
    }

    // Check max uses if applicable
    if (referral.maxUses !== -1 && referral.currentUses >= referral.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'Referral code has reached maximum uses',
      });
    }

    // Add referral code to user
    user.referralCodes.push({
      referralCode: referral._id,
      usedAt: new Date(),
    });

    // Unlock and activate assigned card design if present
    if (referral.assignedCardDesign) {
      const cardDesignId = referral.assignedCardDesign.toString();
      const userUnlockedCollectibles = (user.unlockedCollectibles || []).map(id => id.toString());
      
      if (!userUnlockedCollectibles.includes(cardDesignId)) {
        user.unlockedCollectibles.push(referral.assignedCardDesign);
      }
      
      // Set as active card design
      user.activeCardDesign = referral.assignedCardDesign;
      console.log(`[Referral] Manually unlocking card design ${cardDesignId} for user ${user._id} via referral code ${referral.code}`);
    }

    await user.save();

    // Update referral code usage
    referral.currentUses += 1;
    referral.usedBy.push({
      user: user._id,
      usedAt: new Date(),
    });
    await referral.save();

    // Populate user data for response
    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('referralCodes.referralCode', 'code name')
      .populate('activeCardDesign', 'name imageUrl');

    res.json({
      success: true,
      message: 'User added to referral code successfully',
      user: populatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/admin/referrals/:id
// @desc    Delete/deactivate referral code
// @access  Private/Admin
router.delete('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const referral = await ReferralCode.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found',
      });
    }

    // Soft delete: just deactivate instead of deleting
    referral.isActive = false;
    await referral.save();

    res.json({
      success: true,
      message: 'Referral code deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

