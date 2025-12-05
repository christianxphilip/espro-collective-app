import dotenv from 'dotenv';
import cron from 'node-cron';
import connectDB from './config/db.js';
import { syncLoyaltyCards } from './services/odooSync.js';
import { updateOdooBalance } from './services/odooSync.js';
import OdooBalanceJob from './models/OdooBalanceJob.js';

dotenv.config();

// Connect to MongoDB
connectDB();

console.log('[Worker] Starting ESPRO Collective Worker...');

// Process Odoo balance update jobs from MongoDB queue
async function processOdooBalanceJobs() {
  try {
    // Find and lock a pending job
    const job = await OdooBalanceJob.findOneAndUpdate(
      { status: 'pending' },
      { status: 'processing' },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!job) {
      return; // No pending jobs
    }

    console.log(`[Worker] Processing Odoo balance job ${job._id} for card ${job.odooCardId}`);

    try {
      await updateOdooBalance(job.odooCardId, job.newBalance, job.description);
      
      // Mark as completed
      await OdooBalanceJob.findByIdAndUpdate(job._id, {
        status: 'completed',
        completedAt: new Date(),
      });
      
      console.log(`[Worker] Odoo balance job ${job._id} completed successfully`);
    } catch (error) {
      console.error(`[Worker] Odoo balance job ${job._id} failed:`, error.message);
      
      // Retry logic
      if (job.retries < job.maxRetries) {
        await OdooBalanceJob.findByIdAndUpdate(job._id, {
          status: 'pending',
          $inc: { retries: 1 },
          error: error.message,
        });
        console.log(`[Worker] Job ${job._id} will be retried (attempt ${job.retries + 1}/${job.maxRetries})`);
      } else {
        await OdooBalanceJob.findByIdAndUpdate(job._id, {
          status: 'failed',
          error: error.message,
        });
        console.error(`[Worker] Job ${job._id} failed after ${job.maxRetries} retries. Giving up.`);
      }
    }
  } catch (error) {
    console.error('[Worker] Error processing Odoo balance jobs:', error.message);
  }
}

// Process jobs every 5 seconds
setInterval(processOdooBalanceJobs, 5000);
console.log('[Worker] Odoo balance job processor started (checks every 5 seconds)');

// Setup cron job to sync loyalty cards every hour
// Runs at the top of every hour (e.g., 1:00, 2:00, 3:00, etc.)
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Starting scheduled Odoo sync...');
  try {
    const result = await syncLoyaltyCards();
    console.log('[Cron] Odoo sync completed:', result);
  } catch (error) {
    console.error('[Cron] Odoo sync failed:', error.message);
  }
});

console.log('[Cron] Scheduled Odoo sync job: runs every hour at :00');
console.log('[Worker] Worker is running and ready to process jobs');

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

