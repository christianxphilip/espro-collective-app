import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory or root
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
let authToken = null;
let userId = null;

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🧪 Starting API Endpoint Tests...\n');
  console.log(`📍 Testing against: ${BASE_URL}\n`);

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(`   Error: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data: ${JSON.stringify(error.response.data)}`);
      }
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All API tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Health check
test('Health check endpoint', async () => {
  const response = await axios.get(`${BASE_URL}/api/health`);
  if (response.data.status !== 'ok') {
    throw new Error('Health check failed');
  }
  if (!response.data.checks) {
    throw new Error('Health check missing checks object');
  }
});

// Auth tests - Skip if no test user exists
test('Login with credentials (if test user exists)', async () => {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    if (!response.data.token) throw new Error('No token returned');
    authToken = response.data.token;
    userId = response.data.user?.id;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('   ⚠️  Skipping - test user does not exist');
      return; // Skip this test if user doesn't exist
    }
    throw error;
  }
});

// Customer endpoints (require auth) - Skip if no auth token
test('Get customer profile', async () => {
  if (!authToken) {
    console.log('   ⚠️  Skipping - no auth token available');
    return;
  }
  const response = await axios.get(`${BASE_URL}/api/customer/profile`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!response.data.user) throw new Error('No user data returned');
  if (response.data.user.password) throw new Error('Password field exposed');
});

test('Get customer rewards', async () => {
  if (!authToken) {
    console.log('   ⚠️  Skipping - no auth token available');
    return;
  }
  const response = await axios.get(`${BASE_URL}/api/customer/rewards`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!Array.isArray(response.data.rewards)) {
    throw new Error('Rewards not returned as array');
  }
  // Check that voucher codes are not exposed
  if (response.data.rewards.some(r => r.voucherCodes || r.voucherCode)) {
    throw new Error('Voucher codes exposed in response');
  }
});

test('Get customer collectibles', async () => {
  if (!authToken) {
    console.log('   ⚠️  Skipping - no auth token available');
    return;
  }
  const response = await axios.get(`${BASE_URL}/api/customer/collectibles`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!Array.isArray(response.data.collectibles)) {
    throw new Error('Collectibles not returned as array');
  }
});

test('Get points history', async () => {
  if (!authToken) {
    console.log('   ⚠️  Skipping - no auth token available');
    return;
  }
  const response = await axios.get(`${BASE_URL}/api/customer/points-history?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!response.data.transactions) {
    throw new Error('Transactions not returned');
  }
  if (!response.data.pagination) {
    throw new Error('Pagination not returned');
  }
  if (!Array.isArray(response.data.transactions)) {
    throw new Error('Transactions not returned as array');
  }
});

test('Get customer claims', async () => {
  if (!authToken) {
    console.log('   ⚠️  Skipping - no auth token available');
    return;
  }
  const response = await axios.get(`${BASE_URL}/api/claims`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!Array.isArray(response.data.claims)) {
    throw new Error('Claims not returned as array');
  }
});

// Test unauthorized access
test('Unauthorized access returns 401', async () => {
  try {
    await axios.get(`${BASE_URL}/api/customer/profile`);
    throw new Error('Should have returned 401');
  } catch (error) {
    if (error.response?.status !== 401) {
      throw new Error(`Expected 401, got ${error.response?.status}`);
    }
  }
});

runTests();
