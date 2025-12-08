# S3 Bucket Verification Guide

## Your S3 Configuration
- **Bucket Name**: `espro-collective`
- **Access Key**: `AKIAVS4IBMXRW7H6RJCH`
- **Region**: (Not specified - will default to `us-east-1`)

## Security Note
⚠️ **IMPORTANT**: The credentials above should be added to Render's environment variables, NOT committed to git. They are shown here for verification purposes only.

## Steps to Verify S3 Access

### 1. Add Environment Variables to Render

Go to your Render dashboard → **espro-backend** service → **Environment** tab, and add:

```
AWS_ACCESS_KEY_ID=AKIAVS4IBMXRW7H6RJCH
AWS_SECRET_ACCESS_KEY=33oUXmTvciom1ugaOGeGxPrsbliN3q8P5W2lDoq9
AWS_S3_BUCKET=espro-collective
AWS_REGION=us-east-1
```

(Replace `us-east-1` with your actual bucket region if different)

### 2. Verify Bucket Region

To find your bucket's region:
1. Go to AWS S3 Console
2. Click on your bucket `espro-collective`
3. Check the "Properties" tab
4. Look for "AWS Region" - this is what you should use for `AWS_REGION`

### 3. Configure Bucket Permissions

Your bucket needs public read access for images to be accessible. Add this bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::espro-collective/*"
    }
  ]
}
```

**Steps:**
1. Go to S3 Console → `espro-collective` bucket
2. Click "Permissions" tab
3. Scroll to "Bucket policy"
4. Click "Edit" and paste the policy above
5. Save

### 4. Configure CORS (if needed)

If you encounter CORS errors, add this CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Steps:**
1. Go to S3 Console → `espro-collective` bucket
2. Click "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit" and paste the configuration above
5. Save

### 5. Test the Setup

After adding environment variables to Render and redeploying:

1. **Redeploy the backend service** (environment variables require a rebuild)
2. **Upload an image** through the admin portal (e.g., a card design or reward image)
3. **Check the browser console** for logs:
   - Should see: `[Storage] Using AWS S3 for file storage`
4. **Verify in S3 Console**:
   - Go to your bucket
   - You should see folders: `collectibles/`, `rewards/`, `promotions/`, `settings/`
   - Uploaded images should appear in these folders
5. **Check image URLs**:
   - Image URLs should be like: `https://espro-collective.s3.us-east-1.amazonaws.com/collectibles/collectible-xxx.png`
   - These URLs should be accessible in the browser

### 6. Verify IAM Permissions

Make sure your IAM user has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::espro-collective",
        "arn:aws:s3:::espro-collective/*"
      ]
    }
  ]
}
```

## Troubleshooting

### Images not uploading
- Check backend logs in Render for S3 errors
- Verify environment variables are set correctly
- Check IAM permissions

### Images not displaying (404 errors)
- Verify bucket policy allows public read access
- Check the image URL format matches: `https://espro-collective.s3.REGION.amazonaws.com/path/to/file`
- Verify the region matches your bucket's actual region

### "Access Denied" errors
- Check IAM user permissions
- Verify access key and secret are correct
- Check bucket policy

## Expected Behavior

When S3 is properly configured:
- Backend logs will show: `[Storage] Using AWS S3 for file storage`
- Uploaded images will appear in S3 bucket
- Image URLs will be S3 URLs, not local `/uploads/` paths
- Images will persist across server restarts

## Local Development

For local development, you can either:
1. **Don't set S3 env vars** - will use local filesystem
2. **Set S3 env vars** - will use S3 (useful for testing)

Create `backend/.env`:
```env
AWS_ACCESS_KEY_ID=AKIAVS4IBMXRW7H6RJCH
AWS_SECRET_ACCESS_KEY=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
AWS_S3_BUCKET=espro-collective
AWS_REGION=us-east-1
```

⚠️ **Never commit `.env` files to git!**

