import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Card design dimensions
export const CARD_DIMENSIONS = {
  width: 428,
  height: 380,
  aspectRatio: '1.126:1',
  description: '428x380 pixels',
};

// Initialize OpenAI client (optional - will use if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Stability AI configuration (free tier available)
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
const STABILITY_API_URL = 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image';

// Color palette generation using color theory
function generateColorPalette(baseColor = null) {
  // If no base color provided, generate a random vibrant color
  let baseHue = baseColor 
    ? hexToHsl(baseColor).h 
    : Math.floor(Math.random() * 360);
  
  // Generate complementary colors (opposite on color wheel)
  const complementaryHue = (baseHue + 180) % 360;
  
  // Generate analogous colors (adjacent colors)
  const analogous1Hue = (baseHue + 30) % 360;
  const analogous2Hue = (baseHue - 30 + 360) % 360;
  
  // Generate triadic colors (120 degrees apart)
  const triadic1Hue = (baseHue + 120) % 360;
  const triadic2Hue = (baseHue + 240) % 360;
  
  // Randomly choose a palette type
  const paletteTypes = [
    { type: 'complementary', colors: [baseHue, complementaryHue] },
    { type: 'analogous', colors: [baseHue, analogous1Hue] },
    { type: 'triadic', colors: [baseHue, triadic1Hue] },
  ];
  
  const selected = paletteTypes[Math.floor(Math.random() * paletteTypes.length)];
  
  // Convert HSL to hex with good saturation and lightness
  const color1 = hslToHex(selected.colors[0], 70, 50);
  const color2 = hslToHex(selected.colors[1], 70, 50);
  
  return {
    primary: color1,
    secondary: color2,
    paletteType: selected.type,
  };
}

// Helper: Convert hex to HSL
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Helper: Convert HSL to hex
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Download image from URL and save to local storage
async function downloadAndSaveImage(imageUrl, filename) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(__dirname, '../../uploads/collectibles');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, filename);
    const file = fs.createWriteStream(filePath);
    
    // Use https for OpenAI URLs (they use HTTPS)
    const httpModule = imageUrl.startsWith('https') ? https : http;
    
    httpModule.get(imageUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadAndSaveImage(response.headers.location, filename)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(`/uploads/collectibles/${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// Generate AI image using Stability AI (Stable Diffusion) - FREE TIER AVAILABLE
async function generateImageWithStability(prompt, style = 'modern') {
  if (!STABILITY_API_KEY) {
    return null;
  }

  const enhancedPrompt = `A modern, elegant credit card design with ${prompt}. The design should feature abstract geometric shapes, patterns, and artistic figures. Include creative visual elements like flowing lines, geometric forms, abstract art, minimalist illustrations, or decorative motifs. Premium luxury look, suitable for a loyalty card. ${style} style. The card dimensions are ${CARD_DIMENSIONS.width}x${CARD_DIMENSIONS.height} pixels (aspect ratio ${CARD_DIMENSIONS.aspectRatio}). High quality, clean background, vibrant colors, artistic composition. Design should be optimized for a horizontal card layout.`;

  try {
    const response = await fetch(STABILITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [
          {
            text: enhancedPrompt,
            weight: 1,
          },
        ],
        cfg_scale: 7,
        height: CARD_DIMENSIONS.height,
        width: CARD_DIMENSIONS.width,
        steps: 30,
        samples: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Stability AI request failed');
    }

    const data = await response.json();
    
    // Stability AI returns base64 image
    if (data.artifacts && data.artifacts.length > 0) {
      const base64Image = data.artifacts[0].base64;
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      // Save the image
      const uploadsDir = path.join(__dirname, '../../uploads/collectibles');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filename = `ai-generated-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, imageBuffer);
      
      return {
        imageUrl: `/uploads/collectibles/${filename}`,
        prompt: prompt,
        style: style,
        generated: true,
        provider: 'stability-ai',
      };
    }
  } catch (error) {
    console.error('Stability AI error:', error.message);
    return null;
  }

  return null;
}

// Generate AI image using OpenAI DALL-E
async function generateAIImage(prompt, style = 'modern') {
  // Enhanced prompt for card design with abstract shapes and figures
  const cardAspectRatio = CARD_DIMENSIONS.width / CARD_DIMENSIONS.height; // ~1.586
  const enhancedPrompt = `A modern, elegant credit card design with ${prompt}. The design should feature abstract geometric shapes, patterns, and artistic figures. Include creative visual elements like flowing lines, geometric forms, abstract art, minimalist illustrations, or decorative motifs. Premium luxury look, suitable for a loyalty card. ${style} style. The card dimensions are ${CARD_DIMENSIONS.width}x${CARD_DIMENSIONS.height} pixels (aspect ratio ${CARD_DIMENSIONS.aspectRatio}). High quality, clean background, vibrant colors, artistic composition. Design should be optimized for a horizontal card layout.`;
  
  // Try Stability AI first (free tier available)
  if (STABILITY_API_KEY) {
    const stabilityResult = await generateImageWithStability(prompt, style);
    if (stabilityResult) {
      return stabilityResult;
    }
  }
  
  // Try OpenAI DALL-E if API key is available
  if (openai) {
    try {
      // Use 1792x1024 for DALL-E 3 (closest to card aspect ratio)
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1792x1024', // Closest to 856x540 aspect ratio
        quality: 'standard',
      });
      
      const imageUrl = response.data[0].url;
      
      // Download and save the image
      const filename = `ai-generated-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
      const savedPath = await downloadAndSaveImage(imageUrl, filename);
      
      return {
        imageUrl: savedPath,
        prompt: prompt,
        style: style,
        generated: true,
        provider: 'openai-dalle',
      };
    } catch (error) {
      console.error('OpenAI DALL-E error:', error.message);
      // Fall back to gradient if DALL-E fails
    }
  }
  
  // Fallback: Generate gradient colors based on prompt analysis
  const colorKeywords = {
    orange: '#f66633',
    teal: '#3a878c',
    blue: '#3b82f6',
    purple: '#9333ea',
    green: '#10b981',
    red: '#ef4444',
    pink: '#ec4899',
    yellow: '#fbbf24',
  };
  
  let baseColor = null;
  const lowerPrompt = prompt.toLowerCase();
  for (const [keyword, color] of Object.entries(colorKeywords)) {
    if (lowerPrompt.includes(keyword)) {
      baseColor = color;
      break;
    }
  }
  
  // Generate color palette
  const colors = generateColorPalette(baseColor);
  
  return {
    imageUrl: null,
    gradientColors: {
      primary: colors.primary,
      secondary: colors.secondary,
    },
    prompt: prompt,
    style: style,
    note: (openai || STABILITY_API_KEY) 
      ? 'Image generation failed, using gradient fallback.' 
      : 'No image generation API key configured. Add STABILITY_API_KEY (free tier available) or OPENAI_API_KEY to .env for full image generation. Get free Stability AI key at: https://platform.stability.ai/',
  };
}

// @route   POST /api/ai/generate-colors
// @desc    Generate AI color palette
// @access  Private/Admin
router.post('/generate-colors', protect, requireAdmin, async (req, res) => {
  try {
    const { baseColor } = req.body;
    
    const palette = generateColorPalette(baseColor);
    
    res.json({
      success: true,
      palette,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   POST /api/ai/generate-image
// @desc    Generate AI image for card design
// @access  Private/Admin
router.post('/generate-image', protect, requireAdmin, async (req, res) => {
  try {
    const { prompt, style } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required',
      });
    }
    
    const result = await generateAIImage(prompt, style);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/ai/card-dimensions
// @desc    Get card design dimensions
// @access  Private/Admin
router.get('/card-dimensions', protect, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      dimensions: CARD_DIMENSIONS,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

