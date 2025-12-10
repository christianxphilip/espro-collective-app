# Testing Guide

This document describes how to run tests for the ESPRO Collective App backend.

## Test Scripts

### 1. Functionality Tests
Tests database connectivity, model integrity, and data validation.

```bash
npm run test:functionality
```

**What it tests:**
- Database connection
- Model operations (User, Reward, Claim, PointsTransaction, Collectible)
- Data integrity (email formats, required fields, valid amounts)
- Database indexes

### 2. API Endpoint Tests
Tests API endpoints for correct responses and security.

```bash
npm run test:api
```

**What it tests:**
- Health check endpoint
- Authentication endpoints
- Customer endpoints (requires valid auth token)
- Authorization checks (401 for unauthorized access)
- Response format validation
- Security checks (no password/voucher codes exposed)

**Note:** API tests require a running server. Set `API_URL` environment variable to test against a specific server:
```bash
API_URL=http://localhost:5000 npm run test:api
```

### 3. Run All Tests
Runs both functionality and API tests.

```bash
npm run test:all
```

## Health Check Endpoint

The health check endpoint provides system status information:

```bash
curl http://localhost:5000/api/health
```

**Response includes:**
- Server status and uptime
- Database connection status
- Environment variable checks
- Collection counts

## Environment Setup

Tests require the following environment variables:

- `MONGO_URI` or `MONGODB_URI` - MongoDB connection string
- `API_URL` (optional) - API base URL for endpoint tests (defaults to http://localhost:5000)
- `JWT_SECRET` - JWT secret for token generation (for API tests)

## Test Coverage

Current test coverage includes:
- ✅ Database connectivity
- ✅ Model operations
- ✅ Data integrity
- ✅ Index validation
- ✅ API endpoint responses
- ✅ Security checks
- ⚠️ Unit tests for individual functions (to be added)
- ⚠️ Integration tests for complex workflows (to be added)

## Adding New Tests

### Functionality Tests
Add new test cases in `backend/src/scripts/test-functionality.js`:

```javascript
test('Your test name', async () => {
  // Your test logic
  if (condition) throw new Error('Test failed');
});
```

### API Tests
Add new test cases in `backend/src/scripts/test-api-endpoints.js`:

```javascript
test('Your API test', async () => {
  const response = await axios.get(`${BASE_URL}/api/your-endpoint`);
  if (response.status !== 200) throw new Error('Failed');
});
```

## Troubleshooting

### Tests fail with "MONGODB_URI not set"
- Ensure `.env` file exists in the root directory
- Check that `MONGO_URI` or `MONGODB_URI` is set

### API tests fail with connection errors
- Ensure the server is running: `npm run dev`
- Check that `API_URL` points to the correct server
- Verify CORS settings allow test requests

### Tests timeout
- Check database connection
- Verify network connectivity
- Increase timeout values if needed
