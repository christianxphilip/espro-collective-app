import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.isAdmin; // Password required for customers, optional for admin
    },
    minlength: 6,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  loyaltyId: {
    type: String,
    unique: true,
    sparse: true,
  },
  odooCardId: {
    type: Number,
    sparse: true,
  },
  esproCoins: {
    type: Number,
    default: 0,
    min: 0,
    set: function(value) {
      // Round to 2 decimal places
      return Math.round(value * 100) / 100;
    },
  },
  lifetimeEsproCoins: {
    type: Number,
    default: 0,
    min: 0,
    set: function(value) {
      // Round to 2 decimal places
      return Math.round(value * 100) / 100;
    },
  },
  activeCardDesign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collectible',
    default: null,
  },
  unlockedCollectibles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collectible',
  }],
  isAdmin: {
    type: Boolean,
    default: false,
  },
  loyaltyIdSource: {
    type: String,
    enum: ['pool', 'manual'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;

