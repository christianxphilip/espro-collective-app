# Ngrok Setup Guide

This guide explains how to use ngrok with Docker Compose to expose your backend and customer portal.

## Prerequisites

- Docker and Docker Compose installed
- Ngrok account with auth token (already configured)

## Quick Start

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Get ngrok URLs:**
   - Backend ngrok URL: Visit `http://localhost:4040` and look for the `backend` tunnel URL
   - Customer Portal ngrok URL: Visit `http://localhost:4041` and look for the `customer` tunnel URL

3. **Update Frontend API URL:**
   - Copy the backend ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Set environment variable in customer portal or update the API detection logic

## Services

### Ngrok Backend
- **Container**: `espro-ngrok-backend`
- **Web Interface**: `http://localhost:4040`
- **Exposes**: Backend API (port 5000)
- **URL Format**: `https://[random-id].ngrok-free.app` or `https://[random-id].ngrok.io`

### Ngrok Customer Portal
- **Container**: `espro-ngrok-customer`
- **Web Interface**: `http://localhost:4041`
- **Exposes**: Customer Portal (port 80)
- **URL Format**: `https://[random-id].ngrok-free.app` or `https://[random-id].ngrok.io`

## Getting Ngrok URLs

### Method 1: Web Interface
1. Visit `http://localhost:4040` for backend URL
2. Visit `http://localhost:4041` for customer portal URL
3. Look for the "Forwarding" section to see the public URLs

### Method 2: API
```bash
# Get backend URL
curl http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'

# Get customer portal URL
curl http://localhost:4041/api/tunnels | jq '.tunnels[0].public_url'
```

## Updating Frontend to Use Ngrok Backend

### Option 1: Environment Variable (Recommended)
Set the backend ngrok URL as an environment variable:

```bash
# In docker-compose.yml, add to customer-portal service:
environment:
  - VITE_API_URL=https://your-backend-ngrok-url.ngrok.io/api
```

### Option 2: Update API Detection Logic
The frontend will automatically detect ngrok URLs if you update the detection logic to check for `ngrok.io` or `ngrok-free.app` domains.

## Notes

- **Free Tier**: Ngrok free tier provides random URLs that change on restart
- **Paid Tier**: For static URLs, upgrade to ngrok paid plan
- **HTTPS**: Ngrok provides HTTPS automatically
- **Web Interface**: Use ngrok web interface to inspect requests and see URLs

## Troubleshooting

### Ngrok not starting
- Check if auth token is correct in `ngrok.yml`
- Verify ngrok containers can reach backend/customer-portal services
- Check logs: `docker-compose logs ngrok-backend` or `docker-compose logs ngrok-customer`

### Frontend can't reach backend
- Verify backend ngrok URL is correct
- Check CORS settings in backend
- Ensure backend is running: `docker-compose ps`

### URLs change on restart
- This is normal for free tier
- Consider upgrading to ngrok paid plan for static URLs
- Or use environment variables to update frontend automatically

## Commands

```bash
# Start all services
docker-compose up -d

# View ngrok logs
docker-compose logs -f ngrok-backend
docker-compose logs -f ngrok-customer

# Stop all services
docker-compose down

# Restart ngrok services
docker-compose restart ngrok-backend ngrok-customer
```

