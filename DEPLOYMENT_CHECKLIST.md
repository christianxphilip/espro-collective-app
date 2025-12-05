# Render Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Ready
- [x] All code changes committed
- [x] `render.yaml` configured
- [x] Dockerfiles optimized
- [x] Health check endpoint added (`/api/health`)
- [x] Frontend API URL detection configured for Render
- [x] MongoDB Atlas connection string configured

### 📋 Before Deploying

1. **GitHub Repository**
   - [ ] Code pushed to GitHub
   - [ ] Repository is public or Render has access
   - [ ] Main branch is up to date

2. **MongoDB Atlas**
   - [ ] IP whitelist allows `0.0.0.0/0` (or Render IPs)
   - [ ] Database user has proper permissions
   - [ ] Connection string is correct

3. **Render Account**
   - [ ] Account created at https://render.com
   - [ ] GitHub connected to Render
   - [ ] Payment method added (for services)

## Deployment Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Deploy via Render Blueprint
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Select your GitHub repository
4. Render will auto-detect `render.yaml`
5. Review the 4 services:
   - `espro-backend` (Web Service)
   - `espro-worker` (Background Worker)
   - `espro-customer-portal` (Web Service)
   - `espro-admin-portal` (Web Service)
6. Click **"Apply"** to deploy

### Step 3: Monitor Deployment
- Watch build logs for each service
- Check for any build errors
- Verify all services start successfully

### Step 4: Get Service URLs
After deployment, Render will provide:
- Backend: `https://espro-backend.onrender.com`
- Customer Portal: `https://espro-customer-portal.onrender.com`
- Admin Portal: `https://espro-admin-portal.onrender.com`
- Worker: (no public URL, runs in background)

### Step 5: Verify Deployment
1. **Backend Health Check**
   ```bash
   curl https://espro-backend.onrender.com/api/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Customer Portal**
   - Visit customer portal URL
   - Try logging in
   - Verify API calls work

3. **Test Admin Portal**
   - Visit admin portal URL
   - Login with admin credentials
   - Verify dashboard loads

4. **Check Worker Logs**
   - Go to worker service in Render dashboard
   - Check logs for Odoo sync activity
   - Verify no errors

## Post-Deployment Configuration

### Environment Variables (if needed)
If you need to override defaults, add in Render dashboard:

**Customer Portal:**
- `VITE_API_URL=https://espro-backend.onrender.com/api` (optional)

**Admin Portal:**
- `VITE_API_URL=https://espro-backend.onrender.com/api` (optional)

**Backend:**
- `JWT_SECRET` (auto-generated, can override)
- `MONGO_URI` (already set, verify if needed)

### MongoDB Atlas IP Whitelist
1. Go to MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0` (allows all IPs) OR
3. Add Render's IP ranges (check Render docs)

### Custom Domains (Optional)
1. Go to each service → Settings → Custom Domain
2. Add your domain
3. Update DNS records as instructed
4. SSL certificates auto-generated

## Known Limitations

### ⚠️ File Uploads
- **Issue**: Render uses ephemeral storage
- **Impact**: Uploaded files (images, vouchers) will be lost on restart
- **Solutions**:
  - Use AWS S3 or similar cloud storage
  - Use Render Disk addon (persistent storage)
  - Store files in MongoDB GridFS

### ⚠️ Cold Starts
- **Issue**: Free tier services spin down after inactivity
- **Impact**: First request after idle period may be slow
- **Solution**: Upgrade to paid plan for always-on services

### ⚠️ Resource Limits
- **Issue**: Starter plan has limited resources
- **Impact**: May need to upgrade for production traffic
- **Solution**: Monitor usage and upgrade as needed

## Troubleshooting

### Backend won't start
- Check MongoDB connection string
- Verify MongoDB IP whitelist
- Check backend logs in Render dashboard
- Verify all environment variables are set

### Frontend can't reach backend
- Verify backend is running (check health endpoint)
- Check CORS settings in backend
- Verify frontend API URL detection
- Check browser console for errors

### Worker not processing jobs
- Check worker service logs
- Verify MongoDB connection
- Ensure worker service is running
- Check Odoo credentials

### Images not loading
- Check file upload paths
- Verify upload directories exist
- Check file permissions
- Remember: files are ephemeral on Render

## Service URLs Reference

After deployment, note your service URLs:

- **Backend API**: `https://espro-backend.onrender.com`
- **Customer Portal**: `https://espro-customer-portal.onrender.com`
- **Admin Portal**: `https://espro-admin-portal.onrender.com`

## Support

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com

