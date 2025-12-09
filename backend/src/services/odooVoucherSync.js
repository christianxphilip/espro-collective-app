import axios from 'axios';
import * as cheerio from 'cheerio';
import Reward from '../models/Reward.js';
import Claim from '../models/Claim.js';
import { ensureAuthenticated } from './odooSync.js';

const ODOO_URL = 'https://espressionistpos.odoo.com';

// Create axios instance
const client = axios.create({
  baseURL: ODOO_URL,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    'Origin': ODOO_URL,
  },
});

/**
 * Fetch voucher status from Odoo for a specific reward program
 * @param {number} programId - The Odoo program_id
 * @returns {Promise<Array>} Array of loyalty cards with their claim status
 */
async function fetchVoucherStatusFromOdoo(programId) {
  try {
    // Ensure we're authenticated
    const currentSessionId = await ensureAuthenticated();
    
    console.log(`[Odoo Voucher Sync] Fetching voucher status for program ID: ${programId}`);
    
    // Get session cookies from odooSync
    const { getSessionCookies } = await import('./odooSync.js');
    const sessionCookies = getSessionCookies();
    const apiCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${currentSessionId}; tz=Asia/Manila`;
    
    // Prepare the request payload (based on the curl command)
    const payload = {
      id: 6,
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "loyalty.card",
        method: "web_search_read",
        args: [],
        kwargs: {
          specification: {
            code: {},
            create_date: {},
            points_display: {},
            expiration_date: {},
            program_id: {
              fields: {
                display_name: {}
              }
            },
            partner_id: {
              fields: {
                display_name: {}
              }
            }
          },
          offset: 0,
          order: "",
          limit: 80,
          context: {
            lang: "en_US",
            tz: "Asia/Manila",
            uid: 2,
            allowed_company_ids: [1],
            bin_size: true,
            active_id: programId,
            active_ids: [programId],
            params: {
              active_id: programId,
              action: 424,
              actionStack: [
                { action: 425 },
                { resId: programId, action: 425 },
                { active_id: programId, action: 424 }
              ]
            },
            create: false,
            current_company_id: 1
          },
          count_limit: 10001,
          domain: [["program_id", "=", programId]]
        }
      }
    };
    
    const response = await client.post('/web/dataset/call_kw/loyalty.card/web_search_read', payload, {
      headers: {
        'Cookie': apiCookieString,
        'Referer': `${ODOO_URL}/odoo/action-425/${programId}/action-424`,
      },
    });
    
    // Check if we got an authentication error
    if (response.data.error && (
      response.data.error.message?.includes('Session expired') ||
      response.data.error.message?.includes('Access denied') ||
      response.status === 401 ||
      response.status === 403
    )) {
      console.log('[Odoo Voucher Sync] Session expired during API call, re-authenticating...');
      // Re-authenticate and retry
      await ensureAuthenticated();
      const retryResponse = await client.post('/web/dataset/call_kw/loyalty.card/web_search_read', payload, {
        headers: {
          'Cookie': apiCookieString,
          'Referer': `${ODOO_URL}/odoo/action-425/${programId}/action-424`,
        },
      });
      return retryResponse.data;
    }
    
    return response.data;
  } catch (error) {
    console.error(`[Odoo Voucher Sync] Error fetching voucher status for program ${programId}:`, error.message);
    throw error;
  }
}

/**
 * Sync voucher claim status from Odoo
 * Optimized: Iterate through our claims and cross-check with Odoo data
 * Checks if vouchers are claimed (points_display === "0 Coupon point(s)") and updates Claim records
 */
export async function syncVoucherClaimStatus() {
  try {
    console.log('[Odoo Voucher Sync] Starting voucher claim status sync...');
    
    // Step 1: Get all claims with voucher codes that belong to rewards with odooRewardId
    const claims = await Claim.find({
      voucherCode: { $ne: null }, // Only process claims with voucher codes
    }).populate({
      path: 'reward',
      select: '_id title odooRewardId rewardType',
      match: {
        odooRewardId: { $ne: null, $exists: true },
        rewardType: 'voucher',
      },
    });
    
    // Filter out claims where reward is null (populate didn't match) or reward doesn't have odooRewardId
    const validClaims = claims.filter(claim => 
      claim.reward && 
      claim.reward.odooRewardId && 
      claim.reward.rewardType === 'voucher'
    );
    
    console.log(`[Odoo Voucher Sync] Found ${validClaims.length} claims to sync`);
    
    if (validClaims.length === 0) {
      console.log('[Odoo Voucher Sync] No claims with voucher codes found for rewards with Odoo Reward ID');
      return {
        success: true,
        processed: 0,
        updated: 0,
        errors: 0,
      };
    }
    
    // Step 2: Group claims by reward (odooRewardId) to minimize Odoo API calls
    const claimsByReward = new Map();
    for (const claim of validClaims) {
      const rewardId = claim.reward._id.toString();
      const odooRewardId = claim.reward.odooRewardId;
      
      if (!claimsByReward.has(odooRewardId)) {
        claimsByReward.set(odooRewardId, {
          reward: claim.reward,
          claims: [],
        });
      }
      claimsByReward.get(odooRewardId).claims.push(claim);
    }
    
    console.log(`[Odoo Voucher Sync] Grouped claims into ${claimsByReward.size} rewards`);
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    
    // Step 3: Process each reward group
    for (const [odooRewardId, { reward, claims: rewardClaims }] of claimsByReward) {
      try {
        console.log(`[Odoo Voucher Sync] Processing reward: ${reward.title} (Odoo Program ID: ${odooRewardId}, ${rewardClaims.length} claims)`);
        
        // Fetch voucher status from Odoo (once per reward)
        const odooData = await fetchVoucherStatusFromOdoo(odooRewardId);
        
        if (!odooData.result || !odooData.result.records) {
          console.warn(`[Odoo Voucher Sync] Invalid response from Odoo for reward ${reward._id}`);
          totalErrors++;
          continue;
        }
        
        const loyaltyCards = odooData.result.records;
        console.log(`[Odoo Voucher Sync] Fetched ${loyaltyCards.length} loyalty cards from Odoo for reward ${reward._id}`);
        
        // Step 4: Create lookup map from Odoo data (by voucher code)
        const voucherStatusMap = new Map();
        
        for (const card of loyaltyCards) {
          const voucherCode = card.code;
          if (!voucherCode) continue;
          
          // Check if points_display is "0 Coupon point(s)" - means it's claimed
          const isClaimed = card.points_display === "0 Coupon point(s)" || card.points_display === "0 Coupon point(s)";
          voucherStatusMap.set(voucherCode, isClaimed);
        }
        
        console.log(`[Odoo Voucher Sync] Created lookup map with ${voucherStatusMap.size} voucher codes from Odoo`);
        
        // Step 5: Update claims by cross-checking with Odoo data
        let updatedCount = 0;
        
        for (const claim of rewardClaims) {
          const voucherCode = claim.voucherCode;
          const isClaimedInOdoo = voucherStatusMap.get(voucherCode);
          
          if (isClaimedInOdoo === undefined) {
            // Voucher code not found in Odoo - skip
            continue;
          }
          
          // Update claim if status changed
          if (isClaimedInOdoo && !claim.isUsed) {
            // Mark as used in our system
            claim.isUsed = true;
            claim.usedAt = new Date();
            await claim.save();
            updatedCount++;
            console.log(`[Odoo Voucher Sync] Marked voucher ${voucherCode} as used (claimed in Odoo)`);
          } else if (!isClaimedInOdoo && claim.isUsed) {
            // Mark as unused if it was previously marked as used but Odoo shows it's not claimed
            // This might happen if Odoo was reset or voucher was refunded
            claim.isUsed = false;
            claim.usedAt = null;
            await claim.save();
            updatedCount++;
            console.log(`[Odoo Voucher Sync] Marked voucher ${voucherCode} as unused (not claimed in Odoo)`);
          }
        }
        
        totalProcessed += rewardClaims.length;
        totalUpdated += updatedCount;
        
        console.log(`[Odoo Voucher Sync] Updated ${updatedCount} claims for reward ${reward._id}`);
      } catch (error) {
        console.error(`[Odoo Voucher Sync] Error processing reward ${reward._id}:`, error.message);
        totalErrors++;
      }
    }
    
    console.log(`[Odoo Voucher Sync] Sync complete: ${totalProcessed} processed, ${totalUpdated} updated, ${totalErrors} errors`);
    
    return {
      success: true,
      processed: totalProcessed,
      updated: totalUpdated,
      errors: totalErrors,
    };
  } catch (error) {
    console.error('[Odoo Voucher Sync] Sync error:', error.message);
    throw error;
  }
}

