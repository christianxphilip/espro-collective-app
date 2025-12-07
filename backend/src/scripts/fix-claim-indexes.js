import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/espro-collective';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('claims');

    // Drop existing indexes
    try {
      await collection.dropIndex('user_1_reward_1_voucherCode_1');
      console.log('Dropped index: user_1_reward_1_voucherCode_1');
    } catch (err) {
      console.log('Index user_1_reward_1_voucherCode_1 does not exist or already dropped');
    }

    try {
      await collection.dropIndex('user_1_reward_1_awardedCardDesign_1');
      console.log('Dropped index: user_1_reward_1_awardedCardDesign_1');
    } catch (err) {
      console.log('Index user_1_reward_1_awardedCardDesign_1 does not exist or already dropped');
    }

    // Recreate indexes with sparse option
    await Claim.syncIndexes();
    console.log('Recreated indexes with sparse option');

    // Verify indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes();

