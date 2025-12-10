import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Collectible from '../models/Collectible.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory or root
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🧪 Starting Functionality Tests...\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI or MONGODB_URI environment variable is not set');
    console.error('   Please set MONGO_URI or MONGODB_URI in your .env file or environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    for (const { name, fn } of tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
      } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Database connectivity tests
test('Database connection', async () => {
  const state = mongoose.connection.readyState;
  if (state !== 1) throw new Error(`Database not connected. State: ${state}`);
});

test('User model works', async () => {
  const count = await User.countDocuments();
  if (count < 0) throw new Error('User count invalid');
});

test('Reward model works', async () => {
  const count = await Reward.countDocuments();
  if (count < 0) throw new Error('Reward count invalid');
});

test('Claim model works', async () => {
  const count = await Claim.countDocuments();
  if (count < 0) throw new Error('Claim count invalid');
});

test('PointsTransaction model works', async () => {
  const count = await PointsTransaction.countDocuments();
  if (count < 0) throw new Error('PointsTransaction count invalid');
});

test('Collectible model works', async () => {
  const count = await Collectible.countDocuments();
  if (count < 0) throw new Error('Collectible count invalid');
});

// Data integrity tests
test('Users have valid email format', async () => {
  const users = await User.find().limit(10);
  for (const user of users) {
    if (!user.email.includes('@')) {
      throw new Error(`Invalid email format: ${user.email}`);
    }
  }
});

test('Rewards have required fields', async () => {
  const rewards = await Reward.find().limit(10);
  for (const reward of rewards) {
    if (!reward.title || !reward.description) {
      throw new Error('Reward missing required fields');
    }
    if (reward.esproCoinsRequired < 0) {
      throw new Error('Reward has negative esproCoinsRequired');
    }
  }
});

test('Claims reference valid users', async () => {
  const claims = await Claim.find().limit(10).populate('user');
  for (const claim of claims) {
    if (!claim.user) {
      throw new Error('Claim references invalid user');
    }
  }
});

test('Points transactions have valid amounts', async () => {
  const transactions = await PointsTransaction.find().limit(10);
  for (const tx of transactions) {
    if (tx.amount < 0) {
      throw new Error('Transaction has negative amount');
    }
    if (!['earned', 'used'].includes(tx.type)) {
      throw new Error('Transaction has invalid type');
    }
  }
});

// Index tests
test('User indexes exist', async () => {
  const indexes = await User.collection.getIndexes();
  if (!indexes.email_1) throw new Error('User email index missing');
});

test('Claim indexes exist', async () => {
  const indexes = await Claim.collection.getIndexes();
  const hasVoucherIndex = indexes['user_1_reward_1_voucherCode_1'];
  const hasCardDesignIndex = indexes['user_1_reward_1_awardedCardDesign_1'];
  if (!hasVoucherIndex && !hasCardDesignIndex) {
    throw new Error('Claim unique indexes missing');
  }
});

test('PointsTransaction indexes exist', async () => {
  const indexes = await PointsTransaction.collection.getIndexes();
  const hasUserIndex = indexes['user_1_createdAt_-1'] || indexes['user_1_type_1_createdAt_-1'];
  if (!hasUserIndex) {
    throw new Error('PointsTransaction user index missing');
  }
});

runTests();
