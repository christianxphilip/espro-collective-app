import mongoose from 'mongoose';

const availableLoyaltyIdSchema = new mongoose.Schema({
  loyaltyId: {
    type: String,
    required: [true, 'Loyalty ID is required'],
    unique: true,
    trim: true,
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

const AvailableLoyaltyId = mongoose.model('AvailableLoyaltyId', availableLoyaltyIdSchema);

export default AvailableLoyaltyId;

