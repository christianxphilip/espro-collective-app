import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reward: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward',
    required: true,
  },
  voucherCode: {
    type: String,
    required: function() {
      // Voucher code is required for voucher rewards, but not for card design rewards
      return !this.awardedCardDesign;
    },
    default: null,
  },
  esproCoinsDeducted: {
    type: Number,
    required: true,
  },
  awardedCardDesign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collectible',
    default: null, // Only set for card design rewards
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  usedAt: {
    type: Date,
  },
  claimedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Unique index to prevent duplicate claims
// For voucher rewards: same user + reward + voucherCode (only when voucherCode is not null)
// For card design rewards: same user + reward + awardedCardDesign (only when awardedCardDesign is not null)
// CRITICAL: Use sparse indexes to allow multiple claims with null values
claimSchema.index({ user: 1, reward: 1, voucherCode: 1 }, { 
  unique: true,
  sparse: true, // Only index documents where voucherCode exists
  partialFilterExpression: { voucherCode: { $ne: null } }
});
claimSchema.index({ user: 1, reward: 1, awardedCardDesign: 1 }, { 
  unique: true,
  sparse: true, // Only index documents where awardedCardDesign exists
  partialFilterExpression: { awardedCardDesign: { $ne: null } }
});

// Additional indexes for efficient queries
claimSchema.index({ user: 1, claimedAt: -1 }); // For user claim history
claimSchema.index({ reward: 1, claimedAt: -1 }); // For reward analytics

const Claim = mongoose.model('Claim', claimSchema);

export default Claim;

