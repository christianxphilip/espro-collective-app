import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Collectible from '../models/Collectible.js';

const router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint
// @access  Public
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    health.checks.database = {
      status: dbState === 1 ? 'connected' : 'disconnected',
      readyState: dbState
    };

    // Quick database query test
    const userCount = await User.countDocuments().limit(1);
    health.checks.database.query = 'ok';

    // Check environment variables
    health.checks.environment = {
      nodeEnv: process.env.NODE_ENV || 'not set',
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasAwsConfig: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET),
      hasOdooConfig: !!(process.env.ODOO_URL && process.env.ODOO_DB && process.env.ODOO_USERNAME),
      hasEmailConfig: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
    };

    // Check critical collections
    health.checks.collections = {
      users: await User.countDocuments(),
      rewards: await Reward.countDocuments(),
      claims: await Claim.countDocuments(),
      transactions: await PointsTransaction.countDocuments(),
      collectibles: await Collectible.countDocuments()
    };

    res.status(200).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    health.checks.database = { status: 'error', error: error.message };
    res.status(503).json(health);
  }
});

export default router;
