# Render Environment Variables Setup

## AWS S3 Configuration

Add these environment variables manually in the Render dashboard for the **espro-backend** service:

### Steps:
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select **espro-backend** service
3. Go to **Environment** tab
4. Click **Add Environment Variable** for each:

### Required Variables:

```
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
AWS_S3_BUCKET=espro-collective
AWS_REGION=us-east-1
```

**Note**: Replace `<your-access-key-id>` and `<your-secret-access-key>` with your actual AWS credentials.

**Note**: Replace `us-east-1` with your actual S3 bucket region if different.

### After Adding Variables:
1. **Redeploy** the backend service (required for env vars to take effect)
2. Check logs - you should see: `[Storage] Using AWS S3 for file storage`
3. Test by uploading an image through the admin portal

## Other Environment Variables

The following are already configured in `render.yaml`:
- `NODE_ENV=production`
- `PORT=5000`
- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET` (auto-generated)
- `JWT_EXPIRE=7d`
- `ODOO_USERNAME`
- `ODOO_PASSWORD`

## Security Best Practices

- ✅ Never commit AWS credentials to git
- ✅ Use Render's environment variable management
- ✅ Rotate credentials periodically
- ✅ Use IAM users with minimal required permissions

