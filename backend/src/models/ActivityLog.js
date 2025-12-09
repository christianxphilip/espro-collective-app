import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['odoo_sync', 'odoo_customer_sync', 'odoo_voucher_sync', 'odoo_balance_update'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['success', 'error', 'warning'],
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries by type and status
activityLogSchema.index({ type: 1, status: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 }); // For date range queries

// Auto-cleanup old logs (keep last 90 days)
// Note: TTL index requires createdAt field to be a Date, which it already is
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;

