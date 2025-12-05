# Render Deployment Guide

This guide will help you deploy the ESPRO Collective App to Render using Blueprint.

## Prerequisites

1. GitHub account with the repository pushed
2. Render account (sign up at https://render.com)
3. MongoDB Atlas connection string (already configured in render.yaml)

## Deployment Steps

### 1. Push to GitHub

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Deploy via Render Blueprint

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file
5. Review the services that will be created:
   - **espro-backend** (Web Service)
   - **espro-worker** (Background Worker)
   - **espro-customer-portal** (Web Service)
   - **espro-admin-portal** (Web Service)
6. Click **"Apply"** to deploy

### 3. Configure Environment Variables

After deployment, you may need to update environment variables:

1. Go to each service's settings
2. Update `JWT_SECRET` if needed (it's auto-generated)
3. Verify MongoDB connection string is set correctly

### 4. Get Service URLs

After deployment, Render will provide URLs for each service:

- **Backend**: `https://espro-backend.onrender.com`
- **Customer Portal**: `https://espro-customer-portal.onrender.com`
- **Admin Portal**: `https://espro-admin-portal.onrender.com`

### 5. Update Frontend API URLs (if needed)

The frontend apps automatically detect the backend URL when deployed on Render. However, if you need to override this, you can set the `VITE_API_URL` environment variable in the portal services:

- For Customer Portal: `VITE_API_URL=https://espro-backend.onrender.com/api`
- For Admin Portal: `VITE_API_URL=https://espro-backend.onrender.com/api`

## Service Configuration

### Backend Service
- **Type**: Web Service
- **Port**: 5000 (auto-detected)
- **Health Check**: `/api/health`
- **MongoDB**: Uses MongoDB Atlas (configured in render.yaml)

### Worker Service
- **Type**: Background Worker
- **Runs**: Continuously
- **Tasks**: 
  - Odoo sync (hourly cron job)
  - Odoo balance update queue processing

### Customer Portal
- **Type**: Web Service (Static Site)
- **Build**: Docker build
- **Routes**: All routes rewrite to `/index.html` for SPA routing

### Admin Portal
- **Type**: Web Service (Static Site)
- **Build**: Docker build
- **Routes**: All routes rewrite to `/index.html` for SPA routing

## Important Notes

### File Uploads
⚠️ **Render uses ephemeral storage** - uploaded files will be lost when the service restarts. For production, consider:
- Using AWS S3 or similar cloud storage
- Using Render Disk (persistent storage addon)
- Storing files in MongoDB GridFS

### MongoDB Atlas
- The connection string is already configured in `render.yaml`
- Make sure your MongoDB Atlas IP whitelist allows connections from Render (or use `0.0.0.0/0` for development)

### DNS Configuration
- Render provides automatic HTTPS certificates
- Custom domains can be configured in service settings

### Scaling
- Starter plan allows 1 instance per service
- Upgrade to Standard plan for auto-scaling and better performance

## Troubleshooting

### Backend not connecting to MongoDB
- Check MongoDB Atlas IP whitelist
- Verify connection string in environment variables
- Check backend logs in Render dashboard

### Frontend can't reach backend
- Verify backend service is running (check health endpoint)
- Check CORS settings in backend
- Verify frontend API URL detection logic

### Worker not processing jobs
- Check worker service logs
- Verify MongoDB connection
- Ensure worker service is running

## Local Development

For local development, use Docker Compose:

```bash
docker-compose up
```

Note: Local development still uses MongoDB Atlas (configured in docker-compose.yml environment variables).

## Environment Variables Reference

### Backend & Worker
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT tokens (auto-generated on Render)
- `JWT_EXPIRE`: JWT expiration (default: 7d)
- `ODOO_USERNAME`: Odoo username
- `ODOO_PASSWORD`: Odoo password
- `NODE_ENV`: production
- `PORT`: 5000

### Frontend Portals
- `VITE_API_URL`: Backend API URL (optional, auto-detected)

## Support

For Render-specific issues, check:
- [Render Documentation](https://render.com/docs)
- [Render Status](https://status.render.com)

