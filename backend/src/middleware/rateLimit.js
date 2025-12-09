import rateLimit from 'express-rate-limit';

// General API rate limiter: 100 requests per 15 minutes per IP
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Auth endpoints rate limiter: 5 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, including successful ones
});

// Password reset rate limiter: 3 requests per hour per email
// This uses a custom key generator based on email from request body
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 requests per hour per email
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email from request body as the key (normalized to lowercase)
    const email = req.body?.email?.toLowerCase()?.trim();
    return email || req.ip; // Fallback to IP if no email provided
  },
  skipSuccessfulRequests: false,
});

