import express from 'express';
import Settings from '../models/Settings.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getStorage, getFileUrl, deleteFile } from '../services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// @route   GET /api/settings/public
// @desc    Get public settings (logo, brand colors) - no auth required
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    // Only return public settings (logo and brand colors, not Odoo sync status)
    res.json({
      success: true,
      settings: {
        logoUrl: settings.logoUrl,
        brandColors: settings.brandColors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Multer setup for logo upload with filename preservation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/settings');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename with extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// All routes require authentication and admin role
router.use(protect, requireAdmin);

// @route   GET /api/admin/settings
// @desc    Get current settings
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   PUT /api/admin/settings
// @desc    Update settings (supports both JSON and multipart/form-data for logo upload)
// @access  Private/Admin
router.put('/', upload.single('logo'), async (req, res) => {
  try {
    // Handle both JSON and multipart/form-data
    let odooSyncEnabled, odooCustomerSyncEnabled, odooVoucherSyncEnabled, odooBalanceUpdateEnabled, brandColors, logoUrl;
    
    if (req.file) {
      // Multipart/form-data request (with logo file)
      odooSyncEnabled = req.body.odooSyncEnabled !== undefined ? req.body.odooSyncEnabled === 'true' : undefined;
      odooCustomerSyncEnabled = req.body.odooCustomerSyncEnabled !== undefined ? req.body.odooCustomerSyncEnabled === 'true' : undefined;
      odooVoucherSyncEnabled = req.body.odooVoucherSyncEnabled !== undefined ? req.body.odooVoucherSyncEnabled === 'true' : undefined;
      odooBalanceUpdateEnabled = req.body.odooBalanceUpdateEnabled !== undefined ? req.body.odooBalanceUpdateEnabled === 'true' : undefined;
      brandColors = req.body.brandColors ? JSON.parse(req.body.brandColors) : undefined;
      logoUrl = undefined; // Will be set from uploaded file
    } else {
      // JSON request
      odooSyncEnabled = req.body.odooSyncEnabled;
      odooCustomerSyncEnabled = req.body.odooCustomerSyncEnabled;
      odooVoucherSyncEnabled = req.body.odooVoucherSyncEnabled;
      odooBalanceUpdateEnabled = req.body.odooBalanceUpdateEnabled;
      brandColors = req.body.brandColors;
      logoUrl = req.body.logoUrl;
    }
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    
    // Handle logo file upload if present
    if (req.file) {
      // Delete old logo if exists
      if (settings.logoUrl) {
        const oldLogoPath = path.join(__dirname, '../../', settings.logoUrl);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
      
      // Save new logo path
      const logoPath = req.file.location || getFileUrl(req.file.filename, 'settings');
      settings.logoUrl = logoPath;
      console.log('[Settings] Logo uploaded via PUT:', {
        filename: req.file.filename,
        logoUrl: logoPath,
      });
    } else if (logoUrl !== undefined) {
      // Only update logoUrl if explicitly provided (and not null/empty string)
      if (logoUrl && logoUrl !== 'null' && logoUrl !== '') {
        settings.logoUrl = logoUrl;
      } else if (logoUrl === null || logoUrl === 'null' || logoUrl === '') {
        // If explicitly set to null/empty, preserve existing (don't delete)
        // Only delete if user explicitly wants to remove logo
      }
    }
    // If logoUrl is undefined, preserve existing logoUrl
    
    if (odooSyncEnabled !== undefined) {
      settings.odooSyncEnabled = odooSyncEnabled;
    }
    
    if (odooCustomerSyncEnabled !== undefined) {
      settings.odooCustomerSyncEnabled = odooCustomerSyncEnabled;
    }
    
    if (odooVoucherSyncEnabled !== undefined) {
      settings.odooVoucherSyncEnabled = odooVoucherSyncEnabled;
    }
    
    if (odooBalanceUpdateEnabled !== undefined) {
      settings.odooBalanceUpdateEnabled = odooBalanceUpdateEnabled;
    }
    
    if (brandColors) {
      settings.brandColors = {
        ...settings.brandColors,
        ...brandColors,
      };
    }
    
    await settings.save();
    
    // Re-fetch to ensure we have the latest data including logoUrl
    const updatedSettings = await Settings.findById(settings._id);
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings.toObject(),
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/admin/settings/logo
// @desc    Upload logo
// @access  Private/Admin
router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    console.log('[Settings] Logo upload request received');
    console.log('[Settings] Request file:', req.file);
    console.log('[Settings] Request body:', req.body);
    
    if (!req.file) {
      console.error('[Settings] No file in request');
      return res.status(400).json({
        success: false,
        message: 'No logo file uploaded',
      });
    }
    
    let settings = await Settings.findOne();
    if (!settings) {
      console.log('[Settings] Creating new settings document');
      settings = await Settings.create({});
    }
    
    console.log('[Settings] Current settings before upload:', {
      logoUrl: settings.logoUrl,
      _id: settings._id,
    });
    
    // Delete old logo if exists
    if (settings.logoUrl) {
      try {
        await deleteFile(settings.logoUrl, 'settings');
      } catch (error) {
        console.error('[Settings] Error deleting old logo:', error);
      }
    }
    
    // Save new logo path
    const logoPath = req.file.location || getFileUrl(req.file.filename, 'settings');
    settings.logoUrl = logoPath;
    await settings.save();
    
    console.log('[Settings] Logo uploaded successfully:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      logoUrl: logoPath,
      savedLogoUrl: settings.logoUrl,
    });
    
    // Re-fetch settings to ensure we have the latest data
    const updatedSettings = await Settings.findById(settings._id);
    console.log('[Settings] Updated settings after save:', {
      logoUrl: updatedSettings.logoUrl,
      _id: updatedSettings._id,
    });
    
    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: logoPath,
      settings: updatedSettings.toObject(), // Return full settings object with logoUrl
    });
  } catch (error) {
    console.error('[Settings] Logo upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

