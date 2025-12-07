import express from 'express';
import User from '../models/User.js';
import AvailableLoyaltyId from '../models/AvailableLoyaltyId.js';
import ReferralCode from '../models/ReferralCode.js';
import { generateToken, protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new customer
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Normalize email for comparison
    const normalizedEmail = email.toLowerCase().trim();
    
    // HARD REQUIREMENT: Only assign loyalty IDs that have a matching email address
    // Check if there's a loyalty ID pre-assigned to this specific email
    const availableLoyaltyId = await AvailableLoyaltyId.findOne({
      partnerEmail: normalizedEmail,
      isAssigned: false,
    });

    // If no matching email loyalty ID found, registration cannot proceed
    if (!availableLoyaltyId) {
      return res.status(400).json({
        success: false,
        message: `Registration unavailable. No loyalty ID found for email: ${email}. Please contact support or ensure your email is included in the loyalty ID upload.`,
      });
    }

    // Process referral code if provided
    let referralCodeDoc = null;
    if (referralCode) {
      const normalizedCode = referralCode.trim().toUpperCase();
      referralCodeDoc = await ReferralCode.findOne({ code: normalizedCode });
      
      if (!referralCodeDoc) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code',
        });
      }
      
      if (!referralCodeDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Referral code is not active',
        });
      }
      
      // Check if max uses reached (if maxUses is not -1)
      if (referralCodeDoc.maxUses !== -1 && referralCodeDoc.currentUses >= referralCodeDoc.maxUses) {
        return res.status(400).json({
          success: false,
          message: 'Referral code has reached maximum uses',
        });
      }
    }

    // Create user with loyalty ID and points from CSV if available
    const userData = {
      name: availableLoyaltyId.partnerName || name, // Use partner name from CSV if available, otherwise use provided name
      email,
      password,
      loyaltyId: availableLoyaltyId.loyaltyId,
      esproCoins: availableLoyaltyId.points || 0,
      lifetimeEsproCoins: availableLoyaltyId.points || 0, // Set initial lifetime coins to points from CSV
    };
    
    // Add referral code to user if provided
    if (referralCodeDoc) {
      userData.referralCodes = [{
        referralCode: referralCodeDoc._id,
        usedAt: new Date(),
      }];
    }
    
    const user = await User.create(userData);

    // Mark loyalty ID as assigned
    availableLoyaltyId.isAssigned = true;
    availableLoyaltyId.assignedTo = user._id;
    availableLoyaltyId.assignedAt = new Date();
    await availableLoyaltyId.save();
    
    // Update referral code usage if provided
    if (referralCodeDoc) {
      referralCodeDoc.currentUses += 1;
      referralCodeDoc.usedBy.push({
        user: user._id,
        usedAt: new Date(),
      });
      await referralCodeDoc.save();
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        loyaltyId: user.loyaltyId,
        esproCoins: user.esproCoins,
        lifetimeEsproCoins: user.lifetimeEsproCoins,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password (skip for admin if no password set)
    if (user.isAdmin && !user.password) {
      // Admin login without password check (for hardcoded admin)
      const token = generateToken(user._id);
      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          loyaltyId: user.loyaltyId,
          esproCoins: user.esproCoins,
          lifetimeEsproCoins: user.lifetimeEsproCoins,
          isAdmin: user.isAdmin,
          activeCardDesign: user.activeCardDesign,
        },
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        loyaltyId: user.loyaltyId,
        esproCoins: user.esproCoins,
        lifetimeEsproCoins: user.lifetimeEsproCoins,
        isAdmin: user.isAdmin,
        activeCardDesign: user.activeCardDesign,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
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

export default router;


