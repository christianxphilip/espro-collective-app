# S3 Storage Setup Guide

## Overview
The application now supports AWS S3 for persistent file storage. When S3 credentials are configured, all uploaded images (collectibles, rewards, promotions, logos) will be stored in S3 instead of the local filesystem. This is essential for Render deployments where the filesystem is ephemeral.

## Environment Variables Required

Add these environment variables in your Render service settings:

```
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1  # Optional, defaults to us-east-1
```

## S3 Bucket Configuration

1. **Create an S3 bucket** in your AWS account
2. **Enable public read access** for the bucket:
   - Go to Bucket Policy
   - Add this policy (replace `your-bucket-name`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

3. **Block public access settings**: You may need to uncheck "Block all public access" or configure it to allow public read access

4. **CORS Configuration** (if needed for direct browser uploads):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

## How It Works

- **Without S3 credentials**: Files are stored locally in `/uploads/` directory (works for local development)
- **With S3 credentials**: Files are automatically uploaded to S3 and URLs are constructed as:
  - `https://your-bucket-name.s3.region.amazonaws.com/uploadType/filename`

## File Organization in S3

Files are organized by type:
- `collectibles/` - Card design images
- `rewards/` - Reward images and voucher images
- `promotions/` - Promotion banner images
- `settings/` - Logo images

## Image Processing

- **SVG files**: Stored as-is (no resizing)
- **Raster images** (PNG, JPG, etc.):
  - For collectibles: Automatically resized to 428x380px (card dimensions)
  - For other uploads: Stored at original size

## Migration Notes

- Existing local files will continue to work
- New uploads will go to S3 if configured
- Old local file URLs will still work (they're served by Express static middleware)
- To migrate existing files, you'll need to manually upload them through the admin portal

## Testing

1. Set environment variables in Render
2. Restart the backend service
3. Upload an image through the admin portal
4. Check the S3 bucket to confirm the file was uploaded
5. Verify the image displays correctly in the frontend

