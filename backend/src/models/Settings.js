import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Odoo Integration Settings
  odooSyncEnabled: {
    type: Boolean,
    default: true, // Default to enabled - for registration sync
  },
  odooCustomerSyncEnabled: {
    type: Boolean,
    default: true, // Default to enabled - for hourly customer/points sync
  },
  odooVoucherSyncEnabled: {
    type: Boolean,
    default: true, // Default to enabled - for hourly voucher claim status sync
  },
  odooBalanceUpdateEnabled: {
    type: Boolean,
    default: true, // Default to enabled - for balance updates during redemption
  },
  
  // Brand Settings
  brandColors: {
    primaryOrange: {
      type: String,
      default: '#f66633',
    },
    brown: {
      type: String,
      default: '#4b2e2b',
    },
    cream: {
      type: String,
      default: '#f5e9da',
    },
    dark: {
      type: String,
      default: '#333333',
    },
    teal: {
      type: String,
      default: '#3a878c',
    },
  },
  
  logoUrl: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;

