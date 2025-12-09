import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import AvailableLoyaltyId from '../models/AvailableLoyaltyId.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import Promotion from '../models/Promotion.js';
import Collectible from '../models/Collectible.js';
import Settings from '../models/Settings.js';
import { syncLoyaltyCards } from '../services/odooSync.js';
import odooBalanceQueue from '../jobs/odooBalanceQueue.js';
import csv from 'csv-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// All routes require admin access
router.use(protect, requireAdmin);

// Configure multer for CSV uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// @route   GET /api/admin/dashboard
// @desc    Get dashboard statistics
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ isAdmin: false });
    const totalRewards = await Reward.countDocuments();
    const totalPromotions = await Promotion.countDocuments();
    const totalClaims = await Claim.countDocuments();
    const totalLoyaltyIds = await AvailableLoyaltyId.countDocuments();
    const availableLoyaltyIds = await AvailableLoyaltyId.countDocuments({ isAssigned: false });

    // Get total espro coins distributed
    const claims = await Claim.find();
    const totalCoinsDistributed = claims.reduce((sum, claim) => sum + claim.esproCoinsDeducted, 0);

    // Get total lifetime coins
    const users = await User.find({ isAdmin: false });
    const totalLifetimeCoins = users.reduce((sum, user) => sum + user.lifetimeEsproCoins, 0);

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalRewards,
        totalPromotions,
        totalClaims,
        totalLoyaltyIds,
        availableLoyaltyIds,
        totalCoinsDistributed,
        totalLifetimeCoins,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/customers
// @desc    Get all customers
// @access  Private/Admin
router.get('/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = {
      isAdmin: false,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { loyaltyId: { $regex: search, $options: 'i' } },
        ],
      }),
    };

    const customers = await User.find(query)
      .select('-password')
      .populate('activeCardDesign')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      customers,
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

// @route   GET /api/admin/customers/:id
// @desc    Get a specific customer
// @access  Private/Admin
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id)
      .select('-password')
      .populate('activeCardDesign');

    if (!customer || customer.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Get customer's claims
    const claims = await Claim.find({ user: customer._id })
      .populate('reward')
      .sort({ claimedAt: -1 });

    res.json({
      success: true,
      customer: {
        ...customer.toObject(),
        claims,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/admin/customers/:id/points
// @desc    Update customer points
// @access  Private/Admin
router.put('/customers/:id/points', async (req, res) => {
  try {
    const { esproCoins, lifetimeEsproCoins } = req.body;
    const customer = await User.findById(req.params.id);

    if (!customer || customer.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    if (esproCoins !== undefined) {
      customer.esproCoins = parseFloat(esproCoins);
    }

    if (lifetimeEsproCoins !== undefined) {
      customer.lifetimeEsproCoins = parseFloat(lifetimeEsproCoins);
    }

    await customer.save();

    res.json({
      success: true,
      customer: await User.findById(customer._id).select('-password'),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/points-upload
// @desc    Upload CSV file to update customer current balance (esproCoins)
// @access  Private/Admin
router.post('/points-upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    const results = [];
    const errors = [];
    const updated = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Process each row
    for (const row of results) {
      try {
        const loyaltyId = row.loyalty_id || row.loyaltyId || row.loyaltyID;
        // Support multiple column names for espro coins
        const esproCoins = parseFloat(
          row.espro_coins || 
          row.esproCoins || 
          row.current_balance || 
          row.currentBalance ||
          row.balance ||
          row.points || 
          row.points_to_add || 
          row.pointsToAdd || 
          0
        );

        if (!loyaltyId) {
          errors.push({ row, error: 'Missing loyalty_id' });
          continue;
        }

        if (isNaN(esproCoins) || esproCoins < 0) {
          errors.push({ row, error: 'Invalid espro coins value (must be a non-negative number, supports 2 decimal places)' });
          continue;
        }

        const user = await User.findOne({ loyaltyId });
        if (!user) {
          errors.push({ row, error: `User with loyalty ID ${loyaltyId} not found` });
          continue;
        }

        // Update current balance (esproCoins) - set the value, don't add
        const previousBalance = user.esproCoins;
        user.esproCoins = esproCoins;
        
        // Only update lifetimeEsproCoins if the new balance is higher (to track maximum lifetime)
        if (esproCoins > user.lifetimeEsproCoins) {
          user.lifetimeEsproCoins = esproCoins;
        }
        
        await user.save();
        
        updated.push({
          loyaltyId,
          previousBalance,
          newBalance: esproCoins,
        });
      } catch (error) {
        errors.push({ row, error: error.message });
      }
    }

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      processed: results.length,
      updated: updated.length,
      errors: errors.length,
      errorDetails: errors,
      updates: updated,
    });
  } catch (error) {
    // Delete temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/sync-odoo-points
// @desc    Manually sync loyalty cards and points from Odoo
// @access  Private/Admin
router.post('/sync-odoo-points', async (req, res) => {
  try {
    // Check if customer sync is enabled
    const settings = await Settings.getSettings();
    if (!settings.odooCustomerSyncEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Odoo customer sync is disabled in settings',
      });
    }
    
    console.log('[Admin API] Manual Odoo customer sync requested');
    const result = await syncLoyaltyCards();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Admin API] Odoo customer sync error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/sync-voucher-status
// @desc    Manually sync voucher claim status from Odoo
// @access  Private/Admin
router.post('/sync-voucher-status', async (req, res) => {
  try {
    // Check if voucher sync is enabled
    const settings = await Settings.getSettings();
    if (!settings.odooVoucherSyncEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Odoo voucher sync is disabled in settings',
      });
    }
    
    console.log('[Admin API] Manual voucher claim status sync requested');
    const { syncVoucherClaimStatus } = await import('../services/odooVoucherSync.js');
    const result = await syncVoucherClaimStatus();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Admin API] Voucher claim status sync error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/loyalty-ids-upload
// @desc    Upload CSV file with loyalty IDs
// @access  Private/Admin
router.post('/loyalty-ids-upload', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    const results = [];
    const errors = [];
    const created = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Process each row
    for (const row of results) {
      try {
        // Support multiple column name formats
        // New format: Code, Points, Partner, Partner/Email
        const loyaltyId = row.code || row.Code || row.loyalty_id || row.loyaltyId || row.id;
        const partnerName = row.partner || row.Partner || row.partner_name || row.name || '';
        // Handle "Partner/Email" column (can be written as "Partner/Email" or "partner/email" or "Partner/Email" etc.)
        const partnerEmail = (
          row['Partner/Email'] || 
          row['partner/email'] || 
          row['partner/Email'] || 
          row.partner_email || 
          row.partnerEmail || 
          row.email || 
          ''
        ).toLowerCase().trim();
        const points = parseFloat(row.points || row.Points || row.points_balance || row.espro_coins || row.esproCoins || 0);

        if (!loyaltyId) {
          errors.push({ row, error: 'Missing code/loyalty_id' });
          continue;
        }

        if (partnerEmail && isNaN(points)) {
          errors.push({ row, error: 'Invalid points value (must be a number)' });
          continue;
        }

        // Check if already exists
        const exists = await AvailableLoyaltyId.findOne({ loyaltyId });
        if (exists) {
          // Update existing record with new partner info if provided
          if (partnerEmail) {
            exists.partnerName = partnerName || exists.partnerName;
            exists.partnerEmail = partnerEmail || exists.partnerEmail;
            exists.points = points || exists.points;
            await exists.save();
            created.push(loyaltyId);
          } else {
            errors.push({ row, error: `Loyalty ID ${loyaltyId} already exists` });
          }
          continue;
        }

        await AvailableLoyaltyId.create({
          loyaltyId,
          partnerName: partnerName || undefined,
          partnerEmail: partnerEmail || undefined,
          points: points || 0,
        });
        created.push(loyaltyId);
      } catch (error) {
        errors.push({ row, error: error.message });
      }
    }

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    // Delete temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/loyalty-ids
// @desc    Create a single loyalty ID manually
// @access  Private/Admin
router.post('/loyalty-ids', async (req, res) => {
  try {
    const { loyaltyId } = req.body;

    if (!loyaltyId) {
      return res.status(400).json({
        success: false,
        message: 'Loyalty ID is required',
      });
    }

    // Check if already exists
    const exists = await AvailableLoyaltyId.findOne({ loyaltyId });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Loyalty ID ${loyaltyId} already exists`,
      });
    }

    const newLoyaltyId = await AvailableLoyaltyId.create({ loyaltyId });

    res.status(201).json({
      success: true,
      loyaltyId: newLoyaltyId,
      message: 'Loyalty ID created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/loyalty-ids
// @desc    Get all loyalty IDs
// @access  Private/Admin
router.get('/loyalty-ids', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter || 'all'; // all, assigned, available

    const query = {};
    if (filter === 'assigned') {
      query.isAssigned = true;
    } else if (filter === 'available') {
      query.isAssigned = false;
    }

    const loyaltyIds = await AvailableLoyaltyId.find(query)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await AvailableLoyaltyId.countDocuments(query);
    const available = await AvailableLoyaltyId.countDocuments({ isAssigned: false });
    const assigned = await AvailableLoyaltyId.countDocuments({ isAssigned: true });

    res.json({
      success: true,
      loyaltyIds,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total,
        available,
        assigned,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/rewards
// @desc    Get all rewards with voucher counts
// @access  Private/Admin
router.get('/rewards', async (req, res) => {
  try {
    const rewards = await Reward.find().sort({ createdAt: -1 });

    // Add voucher counts for each reward
    const rewardsWithCounts = rewards.map(reward => {
      const rewardObj = reward.toObject();
      
      if (reward.voucherCodes && reward.voucherCodes.length > 0) {
        const totalVouchers = reward.voucherCodes.length;
        const usedVouchers = reward.voucherCodes.filter(v => v.isUsed).length;
        const availableVouchers = totalVouchers - usedVouchers;
        
        rewardObj.totalVouchers = totalVouchers;
        rewardObj.usedVouchers = usedVouchers;
        rewardObj.availableVouchers = availableVouchers;
        rewardObj.hasVoucherCodes = true;
      } else {
        rewardObj.totalVouchers = 0;
        rewardObj.usedVouchers = 0;
        rewardObj.availableVouchers = reward.quantity === -1 ? -1 : reward.quantity;
        rewardObj.hasVoucherCodes = false;
      }
      
      return rewardObj;
    });

    res.json({
      success: true,
      rewards: rewardsWithCounts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/admin/redemption-history
// @desc    Get redemption history (claims)
// @access  Private/Admin
router.get('/redemption-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const rewardId = req.query.rewardId;
    const userId = req.query.userId;

    const query = {};
    
    if (search) {
      query.$or = [
        { voucherCode: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (rewardId) {
      query.reward = rewardId;
    }
    
    if (userId) {
      query.user = userId;
    }

    const claims = await Claim.find(query)
      .populate('user', 'name email loyaltyId')
      .populate('reward', 'title esproCoinsRequired')
      .sort({ claimedAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Claim.countDocuments(query);

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

// @route   GET /api/admin/queue-status
// @desc    Get Odoo balance queue status
// @access  Private/Admin
router.get('/queue-status', async (req, res) => {
  try {
    const status = await odooBalanceQueue.getStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

