import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Reward title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  esproCoinsRequired: {
    type: Number,
    required: [true, 'Espro coins required is needed'],
    min: 0,
    set: function(value) {
      // Round to 2 decimal places
      return Math.round(value * 100) / 100;
    },
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  voucherCode: {
    type: String,
    trim: true,
  },
  voucherCodes: [{
    code: {
      type: String,
      required: true,
      trim: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  voucherImageUrl: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
    default: -1, // -1 means unlimited, otherwise use voucherCodes.length
    min: -1,
  },
  claimableAtStore: {
    type: Boolean,
    default: false, // If true, reward is claimable at store (no voucher codes needed)
  },
  rewardType: {
    type: String,
    enum: ['voucher', 'specificCardDesign', 'randomCardDesign'],
    default: 'voucher',
  },
  cardDesignIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collectible',
  }],
  odooRewardId: {
    type: Number,
    default: null, // Odoo program_id for voucher rewards
    sparse: true,
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
}, {
  timestamps: true,
});

const Reward = mongoose.model('Reward', rewardSchema);

export default Reward;

