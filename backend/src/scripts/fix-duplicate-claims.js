import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Reward from '../models/Reward.js';
import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixDuplicateClaims() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/espro-collective';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all rewards with maxClaimsPerUser > 0
    const rewards = await Reward.find({
      maxClaimsPerUser: { $gt: 0 }
    });

    console.log(`Found ${rewards.length} rewards with maxClaimsPerUser limit`);

    let totalFixed = 0;
    let totalRefunded = 0;
    let totalCoinsRefunded = 0;

    for (const reward of rewards) {
      console.log(`\nProcessing reward: ${reward.title} (ID: ${reward._id}, maxClaimsPerUser: ${reward.maxClaimsPerUser})`);

      // Find all claims for this reward, grouped by user
      const claimsByUser = await Claim.aggregate([
        {
          $match: {
            reward: reward._id
          }
        },
        {
          $group: {
            _id: '$user',
            claims: {
              $push: {
                claimId: '$_id',
                claimedAt: '$claimedAt',
                esproCoinsDeducted: '$esproCoinsDeducted',
                awardedCardDesign: '$awardedCardDesign',
                voucherCode: '$voucherCode'
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: reward.maxClaimsPerUser }
          }
        }
      ]);

      console.log(`Found ${claimsByUser.length} users with excess claims for this reward`);

      for (const userGroup of claimsByUser) {
        const userId = userGroup._id;
        const claims = userGroup.claims;
        const excessCount = claims.length - reward.maxClaimsPerUser;

        console.log(`  User ${userId}: ${claims.length} claims (max: ${reward.maxClaimsPerUser}, excess: ${excessCount})`);

        // Sort claims by claimedAt (oldest first) - keep the first maxClaimsPerUser claims
        const sortedClaims = claims.sort((a, b) => {
          const dateA = new Date(a.claimedAt);
          const dateB = new Date(b.claimedAt);
          return dateA - dateB;
        });

        const claimsToKeep = sortedClaims.slice(0, reward.maxClaimsPerUser);
        const claimsToDelete = sortedClaims.slice(reward.maxClaimsPerUser);

        console.log(`    Keeping ${claimsToKeep.length} claims, deleting ${claimsToDelete.length} claims`);

        // Process each claim to delete
        for (const claimToDelete of claimsToDelete) {
          const claimId = claimToDelete.claimId;
          
          // Get the full claim document
          const claimDoc = await Claim.findById(claimId).populate('reward');
          
          if (!claimDoc) {
            console.log(`    Warning: Claim ${claimId} not found, skipping`);
            continue;
          }

          // Refund coins if they were deducted
          if (claimDoc.esproCoinsDeducted > 0) {
            const user = await User.findById(userId);
            if (user) {
              const newBalance = user.esproCoins + claimDoc.esproCoinsDeducted;
              await User.findByIdAndUpdate(userId, {
                $inc: { esproCoins: claimDoc.esproCoinsDeducted }
              });
              totalCoinsRefunded += claimDoc.esproCoinsDeducted;
              console.log(`    Refunded ${claimDoc.esproCoinsDeducted} coins to user ${userId} (new balance: ${newBalance})`);
            }
          }

          // Remove unlocked collectible if it was a card design reward
          if (claimDoc.awardedCardDesign) {
            await User.findByIdAndUpdate(userId, {
              $pull: { unlockedCollectibles: claimDoc.awardedCardDesign }
            });
            console.log(`    Removed card design ${claimDoc.awardedCardDesign} from user ${userId}`);
          }

          // Release voucher code back to reward if it was a voucher reward
          if (claimDoc.voucherCode && claimDoc.reward) {
            const reward = await Reward.findById(claimDoc.reward._id || claimDoc.reward);
            if (reward && reward.voucherCodes && Array.isArray(reward.voucherCodes)) {
              const voucherIndex = reward.voucherCodes.findIndex(
                v => v.code === claimDoc.voucherCode && v.isUsed && v.usedBy?.toString() === userId.toString()
              );
              if (voucherIndex !== -1) {
                await Reward.updateOne(
                  { _id: reward._id },
                  {
                    $set: {
                      [`voucherCodes.${voucherIndex}.isUsed`]: false,
                      [`voucherCodes.${voucherIndex}.usedAt`]: null,
                      [`voucherCodes.${voucherIndex}.usedBy`]: null,
                    }
                  }
                );
                console.log(`    Released voucher code ${claimDoc.voucherCode} back to reward`);
              }
            }
          }

          // Delete associated PointsTransaction records
          const deletedTransactions = await PointsTransaction.deleteMany({
            referenceId: claimId,
            referenceType: 'Claim'
          });
          console.log(`    Deleted ${deletedTransactions.deletedCount} associated transaction records`);

          // Delete the claim
          await Claim.findByIdAndDelete(claimId);
          totalFixed++;
          console.log(`    Deleted claim ${claimId}`);
        }

        totalRefunded++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total users fixed: ${totalRefunded}`);
    console.log(`Total claims deleted: ${totalFixed}`);
    console.log(`Total coins refunded: ${totalCoinsRefunded}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing duplicate claims:', error);
    process.exit(1);
  }
}

// Run the script
fixDuplicateClaims();

