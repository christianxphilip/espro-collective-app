import express from 'express';
import mongoose from 'mongoose';
import { protect, requireAdmin } from '../middleware/auth.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import User from '../models/User.js';
import odooBalanceQueue from '../jobs/odooBalanceQueue.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/rewards'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'reward-' + uniqueSuffix + path.extname(file.originalname));
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

// Combined multer for images and CSV files
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // CSV files go to temp, images go to rewards folder
    if (file.fieldname === 'voucherCodes' || file.originalname.endsWith('.csv')) {
      cb(null, path.join(__dirname, '../../uploads/temp'));
    } else {
      cb(null, path.join(__dirname, '../../uploads/rewards'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    if (file.fieldname === 'voucherCodes' || file.originalname.endsWith('.csv')) {
      cb(null, 'voucher-codes-' + uniqueSuffix + path.extname(file.originalname));
    } else {
      cb(null, 'reward-' + uniqueSuffix + path.extname(file.originalname));
    }
  },
});

const combinedUpload = multer({
  storage: combinedStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Allow CSV files for voucherCodes field
    if (file.fieldname === 'voucherCodes' || file.originalname.endsWith('.csv')) {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        return cb(null, true);
      } else {
        return cb(new Error('Only CSV files are allowed for voucher codes'));
      }
    }
    // Allow image files for image and voucherImage fields
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

// @route   POST /api/rewards/claim/:id
// @desc    Claim a reward (idempotent - same request returns same claim)
// @access  Private
router.post('/claim/:id', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const rewardId = req.params.id;

    // Get fresh copy of reward
    const reward = await Reward.findById(rewardId);

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    if (!reward.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Reward is not available',
      });
    }

    // Check if voucher codes are available
    const hasVoucherCodes = reward.voucherCodes && reward.voucherCodes.length > 0;
    
    // Step 1: Atomically reserve a voucher code (if using voucher codes)
    let voucherCode;
    let reservedVoucherIndex = -1;
    
    if (hasVoucherCodes) {
      // Get fresh copy of reward to find available voucher
      const freshReward = await Reward.findById(rewardId);
      const availableIndex = freshReward.voucherCodes?.findIndex(v => !v.isUsed);
      
      if (availableIndex === -1 || availableIndex === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Reward is out of stock (no available voucher codes)',
        });
      }

      const voucherCodeToReserve = freshReward.voucherCodes[availableIndex].code;
      
      // Atomically update the specific voucher by index (only if still unused)
      const updateResult = await Reward.updateOne(
        {
          _id: rewardId,
          [`voucherCodes.${availableIndex}.isUsed`]: false, // Ensure it's still unused
        },
        {
          $set: {
            [`voucherCodes.${availableIndex}.isUsed`]: true,
            [`voucherCodes.${availableIndex}.usedAt`]: new Date(),
            [`voucherCodes.${availableIndex}.usedBy`]: userId,
          },
        }
      );

      if (updateResult.matchedCount === 0) {
        // Voucher was already taken by another concurrent request
        return res.status(409).json({
          success: false,
          message: 'Voucher code was already claimed by another request. Please try again.',
        });
      }

      voucherCode = voucherCodeToReserve;
      reservedVoucherIndex = availableIndex;
    } else {
      // Generate unique voucher code for rewards without voucher codes
      voucherCode = reward.voucherCodePrefix || 'ESPRO-RWD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // Step 2: Check if claim already exists (idempotency check)
    // If the same request comes twice, return the existing claim
    const existingClaim = await Claim.findOne({
      user: userId,
      reward: rewardId,
      voucherCode: voucherCode,
    });

    if (existingClaim) {
      // Claim already exists - return it (idempotency)
      const populatedClaim = await Claim.findById(existingClaim._id)
        .populate({
          path: 'reward',
          select: '-voucherCodes -voucherCode',
        });
      
      const user = await User.findById(userId);
      
      return res.json({
        success: true,
        claim: populatedClaim,
        remainingCoins: user.esproCoins,
        message: 'Claim already exists (idempotent response)',
      });
    }

    // Step 3: Get user and check if user has enough coins and deduct atomically (for non-store rewards)
    const user = await User.findById(userId);
    let updatedUser;
    let coinsDeducted = 0;

    if (!reward.claimableAtStore) {
      // Check balance first
      if (user.esproCoins < reward.esproCoinsRequired) {
        // Refund the voucher code if coins insufficient
        if (hasVoucherCodes && reservedVoucherIndex !== -1) {
          await Reward.updateOne(
            { _id: rewardId },
            {
              $set: {
                [`voucherCodes.${reservedVoucherIndex}.isUsed`]: false,
                [`voucherCodes.${reservedVoucherIndex}.usedAt`]: null,
                [`voucherCodes.${reservedVoucherIndex}.usedBy`]: null,
              },
            }
          );
        }
        
        return res.status(400).json({
          success: false,
          message: 'Insufficient espro coins',
        });
      }

      // Atomically deduct coins
      const newBalance = user.esproCoins - reward.esproCoinsRequired;
      
      updatedUser = await User.findOneAndUpdate(
        { 
          _id: userId,
          esproCoins: { $gte: reward.esproCoinsRequired }
        },
        { 
          $set: { esproCoins: newBalance }
        },
        { new: true }
      );

      if (!updatedUser) {
        // Refund the voucher code if coins deduction failed
        if (hasVoucherCodes && reservedVoucherIndex !== -1) {
          await Reward.updateOne(
            { _id: rewardId },
            {
              $set: {
                [`voucherCodes.${reservedVoucherIndex}.isUsed`]: false,
                [`voucherCodes.${reservedVoucherIndex}.usedAt`]: null,
                [`voucherCodes.${reservedVoucherIndex}.usedBy`]: null,
              },
            }
          );
        }
        
        return res.status(400).json({
          success: false,
          message: 'Insufficient espro coins',
        });
      }

      coinsDeducted = reward.esproCoinsRequired;

      // Queue Odoo balance update as background job (non-blocking)
      if (updatedUser.odooCardId) {
        const description = `Redeem Reward: ${reward.title}, Voucher: ${voucherCode}`;
        odooBalanceQueue.addJob(updatedUser.odooCardId, newBalance, description);
        console.log(`[Reward Claim] Queued Odoo balance update for user ${updatedUser._id}, card ${updatedUser.odooCardId}`);
      }
    } else {
      // For store-claimable rewards, get user without deducting coins
      updatedUser = await User.findById(userId);
    }

    // Step 4: Create claim atomically (with upsert for idempotency)
    // If claim already exists (race condition), return existing one
    let claim;
    try {
      claim = await Claim.findOneAndUpdate(
        {
          user: userId,
          reward: rewardId,
          voucherCode: voucherCode,
        },
        {
          user: userId,
          reward: rewardId,
          voucherCode: voucherCode,
          esproCoinsDeducted: coinsDeducted,
          isUsed: false,
          claimedAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (error) {
      // If unique constraint violation (race condition), fetch existing claim
      if (error.code === 11000) {
        claim = await Claim.findOne({
          user: userId,
          reward: rewardId,
          voucherCode: voucherCode,
        });
      } else {
        // Refund voucher and coins if claim creation fails
        if (!reward.claimableAtStore && coinsDeducted > 0) {
          await User.findByIdAndUpdate(userId, {
            $inc: { esproCoins: coinsDeducted }
          });
        }
        
        if (hasVoucherCodes && reservedVoucherIndex !== -1) {
          await Reward.updateOne(
            { _id: rewardId },
            {
              $set: {
                [`voucherCodes.${reservedVoucherIndex}.isUsed`]: false,
                [`voucherCodes.${reservedVoucherIndex}.usedAt`]: null,
                [`voucherCodes.${reservedVoucherIndex}.usedBy`]: null,
              },
            }
          );
        }
        
        throw error;
      }
    }

    // Step 5: Update reward quantity (if not using voucher codes and not store-claimable)
    if (!reward.claimableAtStore && !hasVoucherCodes && reward.quantity !== -1 && reward.quantity > 0) {
      await Reward.updateOne(
        { _id: rewardId, quantity: { $gt: 0 } },
        { $inc: { quantity: -1 } }
      );
    }

    // Get claim with populated reward (but exclude voucher codes from reward)
    const populatedClaim = await Claim.findById(claim._id)
      .populate({
        path: 'reward',
        select: '-voucherCodes -voucherCode',
      });

    res.json({
      success: true,
      claim: populatedClaim,
      remainingCoins: updatedUser.esproCoins,
    });
  } catch (error) {
    console.error('[Reward Claim] Error:', error.message);
    
    // Handle duplicate key error (idempotency - claim already exists)
    if (error.code === 11000) {
      const existingClaim = await Claim.findOne({
        user: req.user._id,
        reward: req.params.id,
      }).populate({
        path: 'reward',
        select: '-voucherCodes -voucherCode',
      });
      
      if (existingClaim) {
        const user = await User.findById(req.user._id);
        return res.json({
          success: true,
          claim: existingClaim,
          remainingCoins: user.esproCoins,
          message: 'Claim already exists (idempotent response)',
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to claim reward',
    });
  }
});

// Admin routes
router.use(protect, requireAdmin);

// @route   GET /api/rewards
// @desc    Get all rewards (admin) - with voucher counts
// @access  Private/Admin
router.get('/', async (req, res) => {
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

// @route   POST /api/rewards
// @desc    Create a new reward
// @access  Private/Admin
router.post('/', combinedUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'voucherImage', maxCount: 1 },
  { name: 'voucherCodes', maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, description, esproCoinsRequired, quantity, claimableAtStore, voucherUploadRequired } = req.body;

    const rewardData = {
      title: name,
      description,
      esproCoinsRequired: parseInt(esproCoinsRequired),
      quantity: quantity ? parseInt(quantity) : -1,
      createdBy: req.user._id,
      claimableAtStore: claimableAtStore === 'true' || claimableAtStore === true,
      voucherUploadRequired: voucherUploadRequired === 'true' || voucherUploadRequired === true,
    };

    if (req.files?.image) {
      rewardData.imageUrl = `/uploads/rewards/${req.files.image[0].filename}`;
    }

    if (req.files?.voucherImage) {
      rewardData.voucherImageUrl = `/uploads/rewards/${req.files.voucherImage[0].filename}`;
    }

    // Parse voucher codes CSV if provided (not required if claimableAtStore is true)
    if (req.files?.voucherCodes && req.files.voucherCodes[0]) {
      const voucherCodes = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.files.voucherCodes[0].path)
          .pipe(csv())
          .on('data', (row) => {
            const code = row.code || row.voucher_code || row['Voucher Code'] || row['Code'];
            if (code && code.trim()) {
              voucherCodes.push({
                code: code.trim(),
                isUsed: false,
              });
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Delete temp file
      fs.unlinkSync(req.files.voucherCodes[0].path);

      if (voucherCodes.length > 0) {
        rewardData.voucherCodes = voucherCodes;
        rewardData.quantity = voucherCodes.length; // Set quantity based on voucher codes
      }
    } else if (rewardData.voucherUploadRequired && !rewardData.claimableAtStore) {
      // Voucher codes CSV is required if voucherUploadRequired is true and not claimable at store
      return res.status(400).json({
        success: false,
        message: 'Voucher codes CSV is required for this reward type.',
      });
    }

    const reward = await Reward.create(rewardData);

    res.status(201).json({
      success: true,
      reward,
    });
  } catch (error) {
    // Clean up temp files on error
    if (req.files?.voucherCodes && req.files.voucherCodes[0] && fs.existsSync(req.files.voucherCodes[0].path)) {
      fs.unlinkSync(req.files.voucherCodes[0].path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/rewards/:id
// @desc    Update a reward
// @access  Private/Admin
router.put('/:id', combinedUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'voucherImage', maxCount: 1 },
  { name: 'voucherCodes', maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, description, esproCoinsRequired, quantity, voucherCodePrefix, isActive, claimableAtStore, voucherUploadRequired } = req.body;

    const reward = await Reward.findById(req.params.id);
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    if (name) reward.title = name;
    if (description) reward.description = description;
    if (esproCoinsRequired) reward.esproCoinsRequired = parseInt(esproCoinsRequired);
    if (quantity !== undefined) reward.quantity = parseInt(quantity);
    if (voucherCodePrefix) reward.voucherCodePrefix = voucherCodePrefix;
    if (isActive !== undefined) reward.isActive = isActive === 'true' || isActive === true;
    if (claimableAtStore !== undefined) reward.claimableAtStore = claimableAtStore === 'true' || claimableAtStore === true;
    if (voucherUploadRequired !== undefined) reward.voucherUploadRequired = voucherUploadRequired === 'true' || voucherUploadRequired === true;

    if (req.files?.image) {
      reward.imageUrl = `/uploads/rewards/${req.files.image[0].filename}`;
    }

    if (req.files?.voucherImage) {
      reward.voucherImageUrl = `/uploads/rewards/${req.files.voucherImage[0].filename}`;
    }

    // Parse and append new voucher codes from CSV if provided
    if (req.files?.voucherCodes && req.files.voucherCodes[0]) {
      const newVoucherCodes = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.files.voucherCodes[0].path)
          .pipe(csv())
          .on('data', (row) => {
            const code = row.code || row.voucher_code || row['Voucher Code'] || row['Code'];
            if (code && code.trim()) {
              newVoucherCodes.push({
                code: code.trim(),
                isUsed: false,
              });
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Delete temp file
      fs.unlinkSync(req.files.voucherCodes[0].path);

      if (newVoucherCodes.length > 0) {
        // Append new codes, filter out duplicates
        const existingCodes = new Set((reward.voucherCodes || []).map(v => v.code));
        const uniqueNewCodes = newVoucherCodes.filter(newV => !existingCodes.has(newV.code));
        if (!reward.voucherCodes) reward.voucherCodes = [];
        reward.voucherCodes.push(...uniqueNewCodes);
        reward.quantity = reward.voucherCodes.length; // Update quantity
      }
    }

    await reward.save();

    res.json({
      success: true,
      reward,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   DELETE /api/rewards/:id
// @desc    Delete a reward
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    await Reward.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Reward deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

