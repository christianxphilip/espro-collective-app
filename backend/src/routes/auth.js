import express from 'express';
import User from '../models/User.js';
import AvailableLoyaltyId from '../models/AvailableLoyaltyId.js';
import { generateToken, protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new customer
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Get an available loyalty ID
    const availableLoyaltyId = await AvailableLoyaltyId.findOne({ isAssigned: false });

    if (!availableLoyaltyId) {
      return res.status(400).json({
        success: false,
        message: 'Registration temporarily unavailable. No available loyalty IDs.',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      loyaltyId: availableLoyaltyId.loyaltyId,
    });

    // Mark loyalty ID as assigned
    availableLoyaltyId.isAssigned = true;
    availableLoyaltyId.assignedTo = user._id;
    availableLoyaltyId.assignedAt = new Date();
    await availableLoyaltyId.save();

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

