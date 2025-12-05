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
    required: true,
  },
  esproCoinsDeducted: {
    type: Number,
    required: true,
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

// Unique index to prevent duplicate claims (same user + reward + voucherCode)
// This ensures idempotency: if the same request comes twice, only one claim is created
claimSchema.index({ user: 1, reward: 1, voucherCode: 1 }, { unique: true });

const Claim = mongoose.model('Claim', claimSchema);

export default Claim;

