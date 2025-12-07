import express from 'express';
import User from '../models/User.js';
import AvailableLoyaltyId from '../models/AvailableLoyaltyId.js';
<<<<<<< HEAD
import ReferralCode from '../models/ReferralCode.js';
=======
import Settings from '../models/Settings.js';
>>>>>>> feature/odoo-registration-integration
import { generateToken, protect } from '../middleware/auth.js';
import { createOdooPartner, createOdooLoyaltyCard } from '../services/odooSync.js';

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
    
    // Check if Odoo sync is enabled
    const settings = await Settings.getSettings();
    const isOdooSyncEnabled = settings.odooSyncEnabled !== false; // Default to true if not set
    
    let availableLoyaltyId = null;
    
    // If Odoo sync is DISABLED, require a loyalty ID
    if (!isOdooSyncEnabled) {
      // Step 1: Check if there's a loyalty ID pre-assigned to this specific email
      availableLoyaltyId = await AvailableLoyaltyId.findOne({
        partnerEmail: normalizedEmail,
        isAssigned: false,
      });
      
      // Step 2: If no matching email loyalty ID found, check for loyalty ID with no email address
      if (!availableLoyaltyId) {
        availableLoyaltyId = await AvailableLoyaltyId.findOne({
          isAssigned: false,
          $or: [
            { partnerEmail: null },
            { partnerEmail: '' },
            { partnerEmail: { $exists: false } },
          ],
        });
      }
      
      // If still no loyalty ID found, registration cannot proceed
      if (!availableLoyaltyId) {
        return res.status(400).json({
          success: false,
          message: `Registration unavailable. No loyalty ID found for email: ${email}. Please contact support or ensure your email is included in the loyalty ID upload.`,
        });
      }
    } else {
      // If Odoo sync is ENABLED, loyalty ID is optional (for bonus points/name)
      // Step 1: Check if there's a loyalty ID pre-assigned to this specific email
      availableLoyaltyId = await AvailableLoyaltyId.findOne({
        partnerEmail: normalizedEmail,
        isAssigned: false,
      });
      
      // Step 2: If no matching email loyalty ID found, check for loyalty ID with no email address
      if (!availableLoyaltyId) {
        availableLoyaltyId = await AvailableLoyaltyId.findOne({
          isAssigned: false,
          $or: [
            { partnerEmail: null },
            { partnerEmail: '' },
            { partnerEmail: { $exists: false } },
          ],
        });
      }
    }

<<<<<<< HEAD
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
=======
    // Step 1: Create partner in Odoo (only if enabled in settings)
    let odooPartnerId;
    let odooCardId;
    let odooLoyaltyCode;
    
    if (isOdooSyncEnabled) {
      try {
        console.log(`[Registration] Creating Odoo partner for ${name} (${email})`);
        odooPartnerId = await createOdooPartner(
          availableLoyaltyId?.partnerName || name,
          email
        );
        
        // Step 2: Create loyalty card in Odoo
        console.log(`[Registration] Creating Odoo loyalty card for partner ID: ${odooPartnerId}`);
        const loyaltyCardData = await createOdooLoyaltyCard(odooPartnerId);
        odooCardId = loyaltyCardData.id;
        odooLoyaltyCode = loyaltyCardData.code;
        
        console.log(`[Registration] Odoo integration successful:`, {
          partnerId: odooPartnerId,
          cardId: odooCardId,
          code: odooLoyaltyCode
        });
      } catch (odooError) {
        console.error('[Registration] Odoo integration failed:', odooError.message);
        // Don't fail registration if Odoo fails, but log the error
        // Registration can proceed without Odoo sync (can be synced later)
        console.warn('[Registration] Proceeding with registration despite Odoo error');
      }
    } else {
      console.log('[Registration] Odoo sync is disabled in settings, skipping Odoo integration');
    }

    // Create user with loyalty ID and points from Odoo or CSV if available
    const user = await User.create({
      name: availableLoyaltyId?.partnerName || name, // Use partner name from CSV if available, otherwise use provided name
      email,
      password,
      loyaltyId: odooLoyaltyCode || availableLoyaltyId?.loyaltyId || undefined, // Use Odoo code if available, then CSV, otherwise undefined
      odooCardId: odooCardId || undefined, // Store Odoo card ID if available
      esproCoins: availableLoyaltyId?.points || 0, // Use points from CSV if available, otherwise 0
      lifetimeEsproCoins: availableLoyaltyId?.points || 0, // Set initial lifetime coins to points from CSV if available
    });

    // Mark loyalty ID as assigned if one was found and used
    // This is required when Odoo sync is disabled, and optional when enabled
    if (availableLoyaltyId) {
      availableLoyaltyId.isAssigned = true;
      availableLoyaltyId.assignedTo = user._id;
      availableLoyaltyId.assignedAt = new Date();
      await availableLoyaltyId.save();
>>>>>>> feature/odoo-registration-integration
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


