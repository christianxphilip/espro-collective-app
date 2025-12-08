import mongoose from 'mongoose';

const claimLockSchema = new mongoose.Schema({
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
  lockedAt: {
    type: Date,
    default: Date.now,
    expires: 30, // Auto-delete after 30 seconds (lock timeout)
  },
}, {
  timestamps: true,
});

// Unique index to ensure only one lock per user+reward combination
claimLockSchema.index({ user: 1, reward: 1 }, { unique: true });

const ClaimLock = mongoose.model('ClaimLock', claimLockSchema);

export default ClaimLock;

