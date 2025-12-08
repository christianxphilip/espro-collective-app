import express from 'express';
import mongoose from 'mongoose';
import { protect, requireAdmin } from '../middleware/auth.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import User from '../models/User.js';
import Collectible from '../models/Collectible.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Settings from '../models/Settings.js';
import odooBalanceQueue from '../jobs/odooBalanceQueue.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import csv from 'csv-parser';
import { getStorage, getFileUrl } from '../services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads (images only)
const upload = multer({
  storage: getStorage('rewards'),
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
// CSV files must use local storage (for parsing), images can use S3
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // CSV files go to temp (must be local for parsing)
    if (file.fieldname === 'voucherCodes' || file.originalname.endsWith('.csv')) {
      const tempDir = path.join(__dirname, '../../uploads/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    } else {
      // Images use storage service (S3 or local)
      const rewardsDir = path.join(__dirname, '../../uploads/rewards');
      if (!fs.existsSync(rewardsDir)) {
        fs.mkdirSync(rewardsDir, { recursive: true });
      }
      cb(null, rewardsDir);
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

    // Handle card design rewards differently
    // Check if rewardType exists and is a card design type
    const isCardDesignReward = reward.rewardType === 'specificCardDesign' || reward.rewardType === 'randomCardDesign';
    
    if (isCardDesignReward) {
      console.log('[Reward Claim] Processing card design reward:', {
        rewardId: reward._id.toString(),
        rewardType: reward.rewardType,
        cardDesignIds: reward.cardDesignIds,
        cardDesignIdsLength: reward.cardDesignIds?.length,
        cardDesignIdsType: Array.isArray(reward.cardDesignIds) ? 'array' : typeof reward.cardDesignIds
      });
      
      // For card design rewards, skip voucher code logic
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
      
      // Check if user has enough coins (for non-store rewards)
      if (!reward.claimableAtStore) {
        if (user.esproCoins < reward.esproCoinsRequired) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient espro coins',
          });
        }
      }

      // Validate that cardDesignIds exists and is an array
      if (!reward.cardDesignIds || !Array.isArray(reward.cardDesignIds) || reward.cardDesignIds.length === 0) {
        console.error('[Reward Claim] Reward missing cardDesignIds:', {
          rewardId: reward._id.toString(),
          rewardType: reward.rewardType,
          cardDesignIds: reward.cardDesignIds,
          cardDesignIdsType: typeof reward.cardDesignIds,
          isArray: Array.isArray(reward.cardDesignIds)
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid reward configuration: card design reward must have card designs selected',
        });
      }

      // Get user's unlocked collectibles - convert to strings for comparison
      const userUnlockedCollectibles = (user.unlockedCollectibles || []).map(id => id.toString());
      
      let awardedCardDesign = null;
      
      if (reward.rewardType === 'specificCardDesign') {
        // Validate: must have exactly 1 card design
        if (reward.cardDesignIds.length !== 1) {
          console.error('[Reward Claim] Invalid specific card design reward:', {
            rewardId: reward._id.toString(),
            cardDesignIds: reward.cardDesignIds,
            length: reward.cardDesignIds.length
          });
          return res.status(400).json({
            success: false,
            message: 'Invalid reward configuration: specific card design reward must have exactly one card design',
          });
        }
        
        const cardDesignId = reward.cardDesignIds[0];
        const cardDesign = await Collectible.findById(cardDesignId);
        
        if (!cardDesign || !cardDesign.isActive) {
          console.error('[Reward Claim] Card design not found or inactive:', {
            cardDesignId,
            found: !!cardDesign,
            isActive: cardDesign?.isActive
          });
          return res.status(400).json({
            success: false,
            message: 'Card design not found or inactive',
          });
        }
        
        // Check if user already has this card design
        if (userUnlockedCollectibles.includes(cardDesignId.toString())) {
          return res.status(400).json({
            success: false,
            message: 'You already have this card design',
          });
        }
        
        awardedCardDesign = cardDesignId;
      } else if (reward.rewardType === 'randomCardDesign') {
        // Validate: must have at least 2 card designs
        if (!reward.cardDesignIds || reward.cardDesignIds.length < 2) {
          console.error('[Reward Claim] Invalid random card design reward:', {
            rewardId: reward._id,
            cardDesignIds: reward.cardDesignIds,
            length: reward.cardDesignIds?.length
          });
          return res.status(400).json({
            success: false,
            message: 'Invalid reward configuration: random card design reward must have at least two card designs',
          });
        }
        
        // Filter out card designs user already has - convert to strings for comparison
        // Handle both ObjectId and string formats
        const availableDesigns = reward.cardDesignIds.filter(
          designId => {
            const designIdStr = designId.toString ? designId.toString() : String(designId);
            const isUnlocked = userUnlockedCollectibles.includes(designIdStr);
            return !isUnlocked;
          }
        );
        
        console.log('[Reward Claim] Random card design filtering:', {
          rewardId: reward._id.toString(),
          cardDesignIds: reward.cardDesignIds.map(id => id.toString ? id.toString() : String(id)),
          userUnlockedCollectibles,
          availableDesigns: availableDesigns.map(id => id.toString ? id.toString() : String(id)),
          availableCount: availableDesigns.length
        });
        
        if (availableDesigns.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No new card designs available. You already have all designs in this reward.',
          });
        }
        
        // Shuffle the available designs array to ensure true randomness
        // Use Fisher-Yates shuffle algorithm for better randomness
        const shuffledDesigns = [...availableDesigns];
        for (let i = shuffledDesigns.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledDesigns[i], shuffledDesigns[j]] = [shuffledDesigns[j], shuffledDesigns[i]];
        }
        
        // Randomly select one from shuffled designs
        const randomIndex = Math.floor(Math.random() * shuffledDesigns.length);
        awardedCardDesign = shuffledDesigns[randomIndex];
        
        const awardedCardDesignId = awardedCardDesign.toString ? awardedCardDesign.toString() : String(awardedCardDesign);
        
        // CRITICAL: Verify the awarded card is in the available designs
        const isInAvailableDesigns = availableDesigns.some(id => {
          const idStr = id.toString ? id.toString() : String(id);
          return idStr === awardedCardDesignId;
        });
        
        if (!isInAvailableDesigns) {
          console.error('[Reward Claim] CRITICAL ERROR: Selected card is NOT in available designs!', {
            awardedCardDesignId,
            availableDesigns: availableDesigns.map(id => id.toString ? id.toString() : String(id)),
            shuffledDesigns: shuffledDesigns.map(id => id.toString ? id.toString() : String(id)),
            randomIndex
          });
          return res.status(500).json({
            success: false,
            message: 'Error: Selected card design is not available. Please try again.',
          });
        }
        
        // CRITICAL: Verify the awarded card is not already unlocked (double-check)
        if (userUnlockedCollectibles.includes(awardedCardDesignId)) {
          console.error('[Reward Claim] CRITICAL ERROR: Selected card is already unlocked!', {
            awardedCardDesignId,
            userUnlockedCollectibles,
            availableDesigns: availableDesigns.map(id => id.toString ? id.toString() : String(id))
          });
          return res.status(500).json({
            success: false,
            message: 'Error: Selected card design is already unlocked. Please try again.',
          });
        }
        
        console.log('[Reward Claim] Selected random card design:', {
          randomIndex,
          availableDesignsCount: availableDesigns.length,
          shuffledDesignsCount: shuffledDesigns.length,
          awardedCardDesign: awardedCardDesignId,
          allAvailableIds: availableDesigns.map(id => id.toString ? id.toString() : String(id)),
          selectedId: awardedCardDesignId,
          verifiedInAvailable: isInAvailableDesigns,
          verifiedNotUnlocked: !userUnlockedCollectibles.includes(awardedCardDesignId)
        });
      }

      // Deduct coins if not claimable at store
      let updatedUser;
      let coinsDeducted = 0;
      
      if (!reward.claimableAtStore) {
        const newBalance = user.esproCoins - reward.esproCoinsRequired;
        
        updatedUser = await User.findOneAndUpdate(
          { 
            _id: userId,
            esproCoins: { $gte: reward.esproCoinsRequired }
          },
          { 
            $set: { esproCoins: newBalance },
            $addToSet: { unlockedCollectibles: awardedCardDesign } // Add to unlocked collectibles
          },
          { new: true }
        );

        if (!updatedUser) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient espro coins',
          });
        }

        coinsDeducted = reward.esproCoinsRequired;

        // Queue Odoo balance update as background job (non-blocking)
        if (updatedUser.odooCardId) {
          // Check if balance update is enabled
          const settings = await Settings.getSettings();
          if (settings.odooBalanceUpdateEnabled) {
            const description = `Redeem Reward: ${reward.title}, Card Design: ${awardedCardDesign}`;
            odooBalanceQueue.addJob(updatedUser.odooCardId, newBalance, description);
            console.log(`[Reward Claim] Queued Odoo balance update for user ${updatedUser._id}, card ${updatedUser.odooCardId}`);
          } else {
            console.log(`[Reward Claim] Odoo balance update is disabled, skipping queue for user ${updatedUser._id}`);
          }
        }
      } else {
        // For store-claimable rewards, just unlock the card design
        updatedUser = await User.findByIdAndUpdate(
          userId,
          { $addToSet: { unlockedCollectibles: awardedCardDesign } },
          { new: true }
        );
      }

      // For card design rewards, don't generate voucher codes
      // Use a unique tracking identifier for idempotency instead
      const trackingId = `CARD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const voucherCode = null; // No voucher code for card design rewards

      // Check if claim already exists (idempotency) - check by user, reward, and awarded card design
      // CRITICAL: Only return existing claim if it has the SAME awarded card design
      const existingClaim = await Claim.findOne({
        user: userId,
        reward: rewardId,
        awardedCardDesign: awardedCardDesign,
      });

      if (existingClaim) {
        const existingCardDesignId = existingClaim.awardedCardDesign?.toString ? 
          existingClaim.awardedCardDesign.toString() : 
          String(existingClaim.awardedCardDesign);
        const newCardDesignId = awardedCardDesign.toString ? 
          awardedCardDesign.toString() : 
          String(awardedCardDesign);
        
        console.log('[Reward Claim] Found existing claim:', {
          existingClaimId: existingClaim._id.toString(),
          existingCardDesignId,
          newCardDesignId,
          match: existingCardDesignId === newCardDesignId
        });
        
        // Only return existing claim if it matches the current awarded card design
        if (existingCardDesignId === newCardDesignId) {
          const populatedClaim = await Claim.findById(existingClaim._id)
            .populate({
              path: 'reward',
              select: '-voucherCodes -voucherCode',
            })
            .populate({
              path: 'awardedCardDesign',
              select: 'name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl',
            });
          
          // CRITICAL: Verify the populated claim has the correct awardedCardDesign
          const populatedCardDesignId = populatedClaim.awardedCardDesign?._id?.toString();
          const isPopulated = populatedClaim.awardedCardDesign && typeof populatedClaim.awardedCardDesign === 'object' && populatedClaim.awardedCardDesign._id;
          
          console.log('[Reward Claim] Returning existing claim (idempotent):', {
            claimId: populatedClaim._id.toString(),
            populatedCardDesignId,
            expectedCardDesignId: newCardDesignId,
            match: populatedCardDesignId === newCardDesignId,
            hasAwardedCardDesign: !!populatedClaim.awardedCardDesign,
            isPopulated: isPopulated,
            awardedCardDesignType: typeof populatedClaim.awardedCardDesign,
            awardedCardDesignValue: populatedClaim.awardedCardDesign
          });
          
          // CRITICAL: Always fetch awardedCardDesign separately to ensure it's populated
          // Mongoose populate sometimes doesn't work correctly, so we'll fetch it manually
          const cardDesignId = populatedClaim.awardedCardDesign?.toString ? 
            populatedClaim.awardedCardDesign.toString() : 
            (populatedClaim.awardedCardDesign?._id ? populatedClaim.awardedCardDesign._id.toString() : String(populatedClaim.awardedCardDesign));
          
          let awardedCardDesignObj = null;
          if (cardDesignId) {
            // Always fetch it manually to ensure we have the full object
            awardedCardDesignObj = await Collectible.findById(cardDesignId)
              .select('name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl');
            console.log('[Reward Claim] Fetched awardedCardDesign manually:', {
              cardDesignId,
              found: !!awardedCardDesignObj,
              id: awardedCardDesignObj?._id?.toString(),
              name: awardedCardDesignObj?.name,
              imageUrl: awardedCardDesignObj?.imageUrl
            });
          }
          
          if (!awardedCardDesignObj) {
            console.error('[Reward Claim] CRITICAL: Could not fetch awardedCardDesign!', {
              cardDesignId,
              populatedClaimAwardedCardDesign: populatedClaim.awardedCardDesign
            });
            return res.status(500).json({
              success: false,
              message: 'Error: Could not retrieve awarded card design. Please try again.',
            });
          }
          
          return res.json({
            success: true,
            claim: populatedClaim,
            remainingCoins: updatedUser.esproCoins,
            // CRITICAL: Include populated awardedCardDesign in response (frontend expects this)
            awardedCardDesign: awardedCardDesignObj,
            message: 'Claim already exists (idempotent response)',
          });
        } else {
          console.log('[Reward Claim] Existing claim has different card design, creating new claim');
        }
      }

      // Create claim with awarded card design (no voucher code)
      // CRITICAL: Ensure we're creating a NEW claim with the correct awardedCardDesign
      let claim;
      const awardedCardDesignId = awardedCardDesign.toString ? awardedCardDesign.toString() : String(awardedCardDesign);
      
      try {
        // First, check if a claim exists with this exact combination (idempotency)
        const existingClaim = await Claim.findOne({
          user: userId,
          reward: rewardId,
          awardedCardDesign: awardedCardDesign,
        });
        
        if (existingClaim) {
          const existingCardId = existingClaim.awardedCardDesign?.toString ? 
            existingClaim.awardedCardDesign.toString() : 
            String(existingClaim.awardedCardDesign);
          
          console.log('[Reward Claim] Found existing claim with same card design:', {
            claimId: existingClaim._id.toString(),
            existingCardId,
            expectedCardId: awardedCardDesignId,
            match: existingCardId === awardedCardDesignId
          });
          
          if (existingCardId === awardedCardDesignId) {
            // Use existing claim - populate it before returning
            claim = existingClaim;
          } else {
            console.error('[Reward Claim] Existing claim has different card design, creating new one');
            // Create a new claim - the unique index allows multiple claims with different awardedCardDesign
            claim = await Claim.create({
              user: userId,
              reward: rewardId,
              voucherCode: voucherCode, // null for card design rewards
              esproCoinsDeducted: coinsDeducted,
              awardedCardDesign: awardedCardDesign,
              isUsed: false,
              claimedAt: new Date(),
            });
            console.log('[Reward Claim] New claim created:', {
              claimId: claim._id.toString(),
              awardedCardDesign: claim.awardedCardDesign?.toString ? claim.awardedCardDesign.toString() : String(claim.awardedCardDesign)
            });
          }
        } else {
          // Create a new claim with the awarded card design
          console.log('[Reward Claim] Creating new claim with awarded card design:', {
            awardedCardDesign: awardedCardDesignId
          });
          claim = await Claim.create({
            user: userId,
            reward: rewardId,
            voucherCode: voucherCode, // null for card design rewards
            esproCoinsDeducted: coinsDeducted,
            awardedCardDesign: awardedCardDesign,
            isUsed: false,
            claimedAt: new Date(),
          });
          console.log('[Reward Claim] New claim created:', {
            claimId: claim._id.toString(),
            awardedCardDesign: claim.awardedCardDesign?.toString ? claim.awardedCardDesign.toString() : String(claim.awardedCardDesign)
          });
        }
      } catch (error) {
        console.error('[Reward Claim] Error creating claim:', error);
        // Refund coins if claim creation fails
        if (!reward.claimableAtStore && coinsDeducted > 0) {
          await User.findByIdAndUpdate(userId, {
            $inc: { esproCoins: coinsDeducted },
            $pull: { unlockedCollectibles: awardedCardDesign }
          });
          console.log('[Reward Claim] Refunded coins due to claim creation error');
        }
        throw error;
      }
      
      // CRITICAL: Verify the claim has the correct awardedCardDesign immediately after creation
      const claimCardDesignId = claim.awardedCardDesign?.toString ? 
        claim.awardedCardDesign.toString() : 
        String(claim.awardedCardDesign);
      
      console.log('[Reward Claim] Claim verification after creation:', {
        claimCardDesignId,
        expectedCardDesignId: awardedCardDesignId,
        match: claimCardDesignId === awardedCardDesignId,
        claimId: claim._id.toString()
      });
      
      if (claimCardDesignId !== awardedCardDesignId) {
        console.error('[Reward Claim] CRITICAL: Claim has wrong card design after creation!', {
          claimCardDesignId,
          expectedCardDesignId: awardedCardDesignId,
          claimId: claim._id.toString()
        });
        // Refund coins
        if (!reward.claimableAtStore && coinsDeducted > 0) {
          await User.findByIdAndUpdate(userId, {
            $inc: { esproCoins: coinsDeducted },
            $pull: { unlockedCollectibles: awardedCardDesign }
          });
        }
        // Delete the incorrect claim
        await Claim.findByIdAndDelete(claim._id);
        return res.status(500).json({
          success: false,
          message: 'Error: Claim was created with incorrect card design. Please try again.',
        });
      }

      // Create transaction record for used points (if coins were deducted)
      if (coinsDeducted > 0 && claim) {
        await PointsTransaction.create({
          user: userId,
          type: 'used',
          amount: coinsDeducted,
          description: `Redeemed reward: ${reward.title}`,
          referenceId: claim._id,
          referenceType: 'Claim',
          balanceAfter: updatedUser.esproCoins,
        });
      }

      // Get claim with populated reward and card design
      const populatedClaim = await Claim.findById(claim._id)
        .populate({
          path: 'reward',
          select: '-voucherCodes -voucherCode',
        })
        .populate({
          path: 'awardedCardDesign',
          select: 'name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl',
        });

      // CRITICAL: Always fetch awardedCardDesign manually to ensure it's populated
      const cardDesignId = awardedCardDesign.toString ? awardedCardDesign.toString() : String(awardedCardDesign);
      
      let awardedCardDesignObj = await Collectible.findById(cardDesignId)
        .select('name description imageUrl designType gradientColors solidColor textColor backCardColor backCardImageUrl');
      
      console.log('[Reward Claim] Fetched awardedCardDesign for new claim:', {
        cardDesignId,
        found: !!awardedCardDesignObj,
        id: awardedCardDesignObj?._id?.toString(),
        name: awardedCardDesignObj?.name
      });
      
      if (!awardedCardDesignObj) {
        console.error('[Reward Claim] CRITICAL: Could not fetch awardedCardDesign for new claim!', {
          cardDesignId
        });
        return res.status(500).json({
          success: false,
          message: 'Error: Could not retrieve awarded card design. Please try again.',
        });
      }
      
      // Verify the fetched card design matches what we selected
      const fetchedCardDesignId = awardedCardDesignObj._id.toString();
      const expectedCardDesignId = cardDesignId;
      
      console.log('[Reward Claim] Final response verification:', {
        fetchedCardDesignId,
        expectedCardDesignId,
        match: fetchedCardDesignId === expectedCardDesignId,
        cardName: awardedCardDesignObj?.name
      });
      
      if (fetchedCardDesignId !== expectedCardDesignId) {
        console.error('[Reward Claim] CRITICAL: Fetched card design does not match expected!', {
          fetchedCardDesignId,
          expectedCardDesignId,
          claimId: claim._id.toString()
        });
        return res.status(500).json({
          success: false,
          message: 'Error: Claim was created with incorrect card design. Please try again.',
        });
      }

      return res.json({
        success: true,
        claim: populatedClaim,
        remainingCoins: updatedUser.esproCoins,
        // CRITICAL: Always return the manually fetched awardedCardDesign
        awardedCardDesign: awardedCardDesignObj,
      });
    }

    // Original voucher reward logic below
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
        // Check if balance update is enabled
        const settings = await Settings.getSettings();
        if (settings.odooBalanceUpdateEnabled) {
          const description = `Redeem Reward: ${reward.title}, Voucher: ${voucherCode}`;
          odooBalanceQueue.addJob(updatedUser.odooCardId, newBalance, description);
          console.log(`[Reward Claim] Queued Odoo balance update for user ${updatedUser._id}, card ${updatedUser.odooCardId}`);
        } else {
          console.log(`[Reward Claim] Odoo balance update is disabled, skipping queue for user ${updatedUser._id}`);
        }
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

    // Step 5: Create transaction record for used points (if coins were deducted)
    if (coinsDeducted > 0 && claim) {
      await PointsTransaction.create({
        user: userId,
        type: 'used',
        amount: coinsDeducted,
        description: `Redeemed reward: ${reward.title}`,
        referenceId: claim._id,
        referenceType: 'Claim',
        balanceAfter: updatedUser.esproCoins,
      });
    }

    // Step 6: Update reward quantity (if not using voucher codes and not store-claimable)
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
    const { name, description, esproCoinsRequired, quantity, claimableAtStore, voucherUploadRequired, rewardType, cardDesignIds, odooRewardId } = req.body;

    const rewardData = {
      title: name,
      description,
      esproCoinsRequired: parseInt(esproCoinsRequired),
      quantity: quantity ? parseInt(quantity) : -1,
      createdBy: req.user._id,
      claimableAtStore: claimableAtStore === 'true' || claimableAtStore === true,
      voucherUploadRequired: voucherUploadRequired === 'true' || voucherUploadRequired === true,
      rewardType: rewardType || 'voucher',
      odooRewardId: odooRewardId ? parseInt(odooRewardId) : null,
    };

    // Handle card design rewards
    if (rewardData.rewardType === 'specificCardDesign' || rewardData.rewardType === 'randomCardDesign') {
      // Parse cardDesignIds (can be JSON string or array)
      let parsedCardDesignIds = [];
      if (cardDesignIds) {
        if (typeof cardDesignIds === 'string') {
          try {
            parsedCardDesignIds = JSON.parse(cardDesignIds);
          } catch (e) {
            parsedCardDesignIds = [cardDesignIds]; // Single ID as string
          }
        } else if (Array.isArray(cardDesignIds)) {
          parsedCardDesignIds = cardDesignIds;
        }
      }

      // Validate card design IDs
      if (rewardData.rewardType === 'specificCardDesign') {
        if (parsedCardDesignIds.length !== 1) {
          return res.status(400).json({
            success: false,
            message: 'Specific card design reward must have exactly one card design',
          });
        }
      } else if (rewardData.rewardType === 'randomCardDesign') {
        if (parsedCardDesignIds.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Random card design reward must have at least two card designs',
          });
        }
      }

      // Validate all card designs exist and are active
      const cardDesigns = await Collectible.find({
        _id: { $in: parsedCardDesignIds },
        isActive: true,
      });

      if (cardDesigns.length !== parsedCardDesignIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more card designs not found or inactive',
        });
      }

      rewardData.cardDesignIds = parsedCardDesignIds;
    }

    if (req.files?.image) {
      const file = req.files.image[0];
      rewardData.imageUrl = file.location || getFileUrl(file.filename, 'rewards');
    }

    if (req.files?.voucherImage) {
      const voucherFile = req.files.voucherImage[0];
      rewardData.voucherImageUrl = voucherFile.location || getFileUrl(voucherFile.filename, 'rewards');
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
    const { name, description, esproCoinsRequired, quantity, voucherCodePrefix, isActive, claimableAtStore, voucherUploadRequired, rewardType, cardDesignIds, odooRewardId } = req.body;

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
    if (rewardType) reward.rewardType = rewardType;
    if (odooRewardId !== undefined) reward.odooRewardId = odooRewardId ? parseInt(odooRewardId) : null;

    // Handle card design rewards
    if (reward.rewardType === 'specificCardDesign' || reward.rewardType === 'randomCardDesign') {
      // Parse cardDesignIds (can be JSON string or array)
      let parsedCardDesignIds = [];
      if (cardDesignIds) {
        if (typeof cardDesignIds === 'string') {
          try {
            parsedCardDesignIds = JSON.parse(cardDesignIds);
          } catch (e) {
            parsedCardDesignIds = [cardDesignIds]; // Single ID as string
          }
        } else if (Array.isArray(cardDesignIds)) {
          parsedCardDesignIds = cardDesignIds;
        }
      }

      // Validate card design IDs
      if (reward.rewardType === 'specificCardDesign') {
        if (parsedCardDesignIds.length !== 1) {
          return res.status(400).json({
            success: false,
            message: 'Specific card design reward must have exactly one card design',
          });
        }
      } else if (reward.rewardType === 'randomCardDesign') {
        if (parsedCardDesignIds.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Random card design reward must have at least two card designs',
          });
        }
      }

      // Validate all card designs exist and are active
      if (parsedCardDesignIds.length > 0) {
        const cardDesigns = await Collectible.find({
          _id: { $in: parsedCardDesignIds },
          isActive: true,
        });

        if (cardDesigns.length !== parsedCardDesignIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more card designs not found or inactive',
          });
        }

        reward.cardDesignIds = parsedCardDesignIds;
      }
    } else {
      // Clear cardDesignIds for non-card-design rewards
      reward.cardDesignIds = [];
    }

    if (req.files?.image) {
      reward.imageUrl = `/uploads/rewards/${req.files.image[0].filename}`;
    }

    if (req.files?.voucherImage) {
      const voucherFile = req.files.voucherImage[0];
      reward.voucherImageUrl = voucherFile.location || getFileUrl(voucherFile.filename, 'rewards');
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

