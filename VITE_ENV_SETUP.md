# VITE_API_URL Environment Variable Setup

## Issue
The admin portal (and customer portal) need `VITE_API_URL` to be set during the **build process** because Vite embeds environment variables at build time, not runtime.

## Solution

### Option 1: Using render.yaml (Recommended)
The `render.yaml` file already includes `VITE_API_URL` for both portals. After deploying, Render should automatically use it during the build.

### Option 2: Manual Configuration in Render Dashboard
If the `render.yaml` configuration doesn't work, manually set the environment variable:

1. Go to your Render dashboard
2. Select the **espro-admin-portal** service
3. Go to **Environment** tab
4. Add environment variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://espro-backend.onrender.com/api`
5. **Redeploy** the service (the build needs to run again for the env var to be embedded)

### Option 3: Local Development
For local development, create a `.env` file in `apps/admin-portal/`:

```env
VITE_API_URL=http://localhost:8000/api
```

## How to Verify

1. Open the admin portal in your browser
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for log messages starting with `[API]`
5. You should see: `[API] Using VITE_API_URL: https://espro-backend.onrender.com/api`

If you see `[API] VITE_API_URL not set or empty, detecting from hostname`, then the environment variable wasn't available during build.

## Troubleshooting

### Environment variable not working after setting it
- **Solution**: You must **redeploy** the service after adding/changing environment variables. The build process needs to run again to embed the new value.

### Still seeing localhost URLs
- Check that `VITE_API_URL` is set in Render's environment variables
- Verify the value is correct (should end with `/api`)
- Check the build logs in Render to see if the env var was available during build
- Look at browser console for the `[API]` debug logs

### For Customer Portal
The same steps apply to `espro-customer-portal` service - add `VITE_API_URL` there as well.

