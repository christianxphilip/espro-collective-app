import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'espressionistmarketing@gmail.com',
    pass: process.env.EMAIL_PASS || '', // App password
  },
});

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} resetToken - Password reset token
 * @param {string} userName - User's name
 * @returns {Promise<object>}
 */
export async function sendPasswordResetEmail(email, resetToken, userName) {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"ESPRO Collective" <${process.env.EMAIL_USER || 'espressionistmarketing@gmail.com'}>`,
      to: email,
      subject: 'Reset Your ESPRO Collective Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f66633 0%, #ff8c64 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">ESPRO Collective</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #f66633; margin-top: 0;">Password Reset Request</h2>
            <p>Hello ${userName || 'there'},</p>
            <p>We received a request to reset your password for your ESPRO Collective account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #f66633 0%, #ff8c64 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px;">
              <strong>Important:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Best regards,<br>
              The ESPRO Collective Team
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        ESPRO Collective - Password Reset Request
        
        Hello ${userName || 'there'},
        
        We received a request to reset your password for your ESPRO Collective account.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        
        Best regards,
        The ESPRO Collective Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('[Email] Error sending password reset email:', error.message);
    throw error;
  }
}

/**
 * Verify email configuration
 * @returns {Promise<boolean>}
 */
export async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('[Email] Email configuration verified successfully');
    return true;
  } catch (error) {
    console.error('[Email] Email configuration verification failed:', error.message);
    return false;
  }
}

