import mongoose from 'mongoose';

const odooBalanceJobSchema = new mongoose.Schema({
  odooCardId: {
    type: Number,
    required: true,
  },
  newBalance: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  retries: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  error: {
    type: String,
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for efficient querying of pending jobs
odooBalanceJobSchema.index({ status: 1, createdAt: 1 });

const OdooBalanceJob = mongoose.model('OdooBalanceJob', odooBalanceJobSchema);

export default OdooBalanceJob;

