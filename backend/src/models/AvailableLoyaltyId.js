import mongoose from 'mongoose';

const availableLoyaltyIdSchema = new mongoose.Schema({
  loyaltyId: {
    type: String,
    required: [true, 'Loyalty ID is required'],
    unique: true,
    trim: true,
  },
  partnerName: {
    type: String,
    trim: true,
  },
  partnerEmail: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
  },
  points: {
    type: Number,
    default: 0,
    min: 0,
    set: (v) => parseFloat(v.toFixed(2)), // Round to 2 decimal places
  },
  isAssigned: {
    type: Boolean,
    default: false,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for faster email lookups
availableLoyaltyIdSchema.index({ partnerEmail: 1 });

const AvailableLoyaltyId = mongoose.model('AvailableLoyaltyId', availableLoyaltyIdSchema);

export default AvailableLoyaltyId;

