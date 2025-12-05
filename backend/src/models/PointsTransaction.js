import mongoose from 'mongoose';

const pointsTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['earned', 'used'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
    set: function(value) {
      // Round to 2 decimal places
      return Math.round(value * 100) / 100;
    },
  },
  description: {
    type: String,
    trim: true,
  },
  // Reference to related entity (e.g., Claim ID for used points)
  // Note: OdooSync transactions don't have a referenceId (set to null)
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Claim', // Only used when referenceType is 'Claim'
    default: null,
  },
  referenceType: {
    type: String,
    enum: ['Claim', 'OdooSync', null],
    default: null,
  },
  // Balance after this transaction
  balanceAfter: {
    type: Number,
    required: true,
    set: function(value) {
      return Math.round(value * 100) / 100;
    },
  },
}, {
  timestamps: true,
});

// Index for efficient queries
pointsTransactionSchema.index({ user: 1, createdAt: -1 });
pointsTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });

const PointsTransaction = mongoose.model('PointsTransaction', pointsTransactionSchema);

export default PointsTransaction;

