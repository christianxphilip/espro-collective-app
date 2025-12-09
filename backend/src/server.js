import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron';
import mongoose from 'mongoose';
import helmet from 'helmet';
import connectDB from './config/db.js';
import { syncLoyaltyCards } from './services/odooSync.js';
import { updateOdooBalance } from './services/odooSync.js';
import OdooBalanceJob from './models/OdooBalanceJob.js';
import Settings from './models/Settings.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { logActivity } from './services/activityLog.js';

// Import routes
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customer.js';
import adminRoutes from './routes/admin.js';
import collectibleRoutes from './routes/collectibles.js';
import rewardRoutes from './routes/rewards.js';
import promotionRoutes from './routes/promotions.js';
import claimRoutes from './routes/claims.js';
import aiRoutes from './routes/ai.js';
import referralRoutes from './routes/referrals.js';
import settingsRoutes from './routes/settings.js';

// ES6 module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Connect to MongoDB (will be awaited before server starts)
let dbConnected = false;

// Configure allowed origins for CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.ADMIN_URL || 'http://localhost:5174',
  // Production URLs (if set)
  process.env.CUSTOMER_PORTAL_URL,
  process.env.ADMIN_PORTAL_URL,
].filter(Boolean); // Remove undefined values

// Add localhost variants for development and Docker
// Always include common localhost ports for local development
allowedOrigins.push(
  'http://localhost:5173', // Vite dev server - customer portal
  'http://localhost:5174', // Vite dev server - admin portal
  'http://localhost:8080', // Docker - customer portal
  'http://localhost:8081', // Docker - admin portal
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081'
);

// Log allowed origins on startup (for debugging)
console.log('[Server] CORS allowed origins:', allowedOrigins);

// Ensure upload directories exist
const uploadDirs = [
  path.join(__dirname, '../uploads/rewards'),
  path.join(__dirname, '../uploads/promotions'),
  path.join(__dirname, '../uploads/collectibles'),
  path.join(__dirname, '../uploads/temp'),
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Security Middleware
// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"], // Allow images from any source (for S3, local uploads, etc.)
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow image uploads
}));

// CORS configuration - restrict to specific origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      // Always allow requests with no origin for development and some production use cases
      return callback(null, true);
    }
    
    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedOrigin === normalizedAllowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // Log the blocked origin for debugging
      console.warn(`[CORS] Blocked origin: ${normalizedOrigin}`);
      console.warn(`[CORS] Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting - apply to all API routes
app.use('/api/', generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), message: 'ESPRO Collective API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/collectibles', collectibleRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin/referrals', referralRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin/settings', settingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

// Start server after MongoDB connection
async function startServer() {
  try {
    // Connect to MongoDB first
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();
    dbConnected = true;
    console.log('[Server] MongoDB connected successfully');
    
    // Start the Express server
    app.listen(PORT, () => {
      console.log(`[Server] Server running on port ${PORT}`);
      
      // Start worker functionality after a short delay to ensure DB is ready
      setTimeout(() => {
        startWorker();
      }, 2000); // 2 second delay to ensure DB connection is stable
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Server] Unhandled Promise Rejection:', err);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'production') {
    console.error('[Server] Continuing despite unhandled rejection');
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
startServer();

// Worker functionality (runs alongside API server)
function startWorker() {
  // Only start worker if DB is connected
  if (!dbConnected) {
    console.error('[Worker] Cannot start worker: MongoDB not connected');
    return;
  }
  
  console.log('[Worker] Starting ESPRO Collective Worker...');
  
  // Process Odoo balance update jobs from MongoDB queue
  async function processOdooBalanceJobs() {
    try {
      // Check if DB is still connected
      if (mongoose.connection.readyState !== 1) {
        console.warn('[Worker] MongoDB not connected, skipping job processing');
        return;
      }
      
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
        // Check if balance update is enabled
        const settings = await Settings.getSettings();
        if (!settings.odooBalanceUpdateEnabled) {
          console.log(`[Worker] Odoo balance update is disabled in settings, skipping job ${job._id}`);
          await logActivity('odoo_balance_update', 'warning',
            `Odoo balance update is disabled in settings, skipping job ${job._id}`,
            { jobId: job._id, odooCardId: job.odooCardId }
          );
          // Mark as completed but skipped
          await OdooBalanceJob.findByIdAndUpdate(job._id, {
            status: 'completed',
            completedAt: new Date(),
            error: 'Odoo balance update is disabled in settings',
          });
          return;
        }
        
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
      // Don't log connection errors as errors, just skip processing
      if (error.message && error.message.includes('connection')) {
        console.warn('[Worker] MongoDB connection issue, will retry on next cycle');
      } else {
        console.error('[Worker] Error processing Odoo balance jobs:', error.message);
      }
    }
  }

  // Process jobs every 5 seconds
  setInterval(processOdooBalanceJobs, 5000);
  console.log('[Worker] Odoo balance job processor started (checks every 5 seconds)');

  // Setup cron job to sync loyalty cards every hour
  // Runs at the top of every hour (e.g., 1:00, 2:00, 3:00, etc.)
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Starting scheduled Odoo customer sync...');
    try {
      // Check if DB is connected before syncing
      if (mongoose.connection.readyState !== 1) {
        console.warn('[Cron] MongoDB not connected, skipping sync');
        return;
      }
      
      // Check if customer sync is enabled
      const settings = await Settings.getSettings();
      if (!settings.odooCustomerSyncEnabled) {
        console.log('[Cron] Odoo customer sync is disabled in settings, skipping');
        await logActivity('odoo_customer_sync', 'warning',
          'Odoo customer sync is disabled in settings, skipping scheduled sync',
          {}
        );
        return;
      }
      
      const result = await syncLoyaltyCards();
      console.log('[Cron] Odoo customer sync completed:', result);
    } catch (error) {
      console.error('[Cron] Odoo customer sync failed:', error.message);
      await logActivity('odoo_customer_sync', 'error',
        `Scheduled Odoo customer sync failed: ${error.message}`,
        { error: error.message }
      );
    }
  });

  // Setup cron job to sync voucher claim status every hour (runs at the same time as loyalty sync)
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Starting scheduled Odoo voucher claim status sync...');
    try {
      // Check if DB is connected before syncing
      if (mongoose.connection.readyState !== 1) {
        console.warn('[Cron] MongoDB not connected, skipping voucher sync');
        return;
      }
      
      // Check if voucher sync is enabled
      const settings = await Settings.getSettings();
      if (!settings.odooVoucherSyncEnabled) {
        console.log('[Cron] Odoo voucher sync is disabled in settings, skipping');
        await logActivity('odoo_voucher_sync', 'warning',
          'Odoo voucher sync is disabled in settings, skipping scheduled sync',
          {}
        );
        return;
      }
      
      const { syncVoucherClaimStatus } = await import('./services/odooVoucherSync.js');
      const result = await syncVoucherClaimStatus();
      console.log('[Cron] Odoo voucher claim status sync completed:', result);
    } catch (error) {
      console.error('[Cron] Odoo voucher claim status sync failed:', error.message);
      await logActivity('odoo_voucher_sync', 'error',
        `Scheduled Odoo voucher claim status sync failed: ${error.message}`,
        { error: error.message }
      );
    }
  });

  console.log('[Cron] Scheduled Odoo sync job: runs every hour at :00');
  console.log('[Cron] Scheduled Odoo voucher claim status sync job: runs every hour at :00');
  console.log('[Worker] Worker is running and ready to process jobs');
}

