import mongoose from 'mongoose';

const collectibleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Card design name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  // Card design can be either an image or gradient colors
  imageUrl: {
    type: String,
    trim: true,
  },
  // For gradient-based designs
  gradientColors: {
    primary: {
      type: String,
      trim: true,
    },
    secondary: {
      type: String,
      trim: true,
    },
  },
  designType: {
    type: String,
    enum: ['image', 'gradient', 'solid', 'reward'],
    default: 'gradient',
  },
  solidColor: {
    type: String,
    trim: true,
  },
  textColor: {
    type: String,
    default: '#FFFFFF', // Default white text
    trim: true,
  },
  // Back card design (separate from front)
  backCardColor: {
    type: String,
    trim: true,
    default: null,
  },
  backCardImageUrl: {
    type: String,
    trim: true,
  },
  lifetimeEsproCoinsRequired: {
    type: Number,
    required: function() {
      return this.designType !== 'reward'; // Not required for reward-type designs
    },
    min: 0,
    default: 0, // Default design is unlocked at 0
  },
  isAIGenerated: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false, // Only one default design
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

const Collectible = mongoose.model('Collectible', collectibleSchema);

export default Collectible;

