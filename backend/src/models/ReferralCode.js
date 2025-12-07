import mongoose from 'mongoose';

const referralCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Referral code is required'],
    unique: true,
    trim: true,
    uppercase: true,
  },
  name: {
    type: String,
    required: [true, 'Referral code name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  assignedCardDesign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collectible',
    default: null,
  },
  assignedReward: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward',
    default: null,
  },
  maxUses: {
    type: Number,
    default: -1, // -1 means unlimited
    min: -1,
  },
  currentUses: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  usedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Index on code for fast lookups
referralCodeSchema.index({ code: 1 });

const ReferralCode = mongoose.model('ReferralCode', referralCodeSchema);

export default ReferralCode;

