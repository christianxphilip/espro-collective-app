import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import connectDB from './config/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customer.js';
import adminRoutes from './routes/admin.js';
import collectibleRoutes from './routes/collectibles.js';
import rewardRoutes from './routes/rewards.js';
import promotionRoutes from './routes/promotions.js';
import claimRoutes from './routes/claims.js';
import aiRoutes from './routes/ai.js';

// ES6 module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

