import axios from 'axios';
import * as cheerio from 'cheerio';
import User from '../models/User.js';

const ODOO_URL = 'https://espressionistpos.odoo.com';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'espressionist.pos@gmail.com';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'Coffee@0118';

// Store session info
let sessionId = null;
let sessionExpiry = null;
let sessionCookies = ''; // Store all cookies for the session

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
    'Referer': `${ODOO_URL}/odoo/action-284/2/4/action_edit_dashboard/4`,
  },
});

/**
 * Login to Odoo and get session_id
 */
async function loginToOdoo() {
  try {
    console.log('[Odoo Sync] Logging in to Odoo...');
    
    // Step 1: Get login page to extract CSRF token
    const loginPageResponse = await client.get('/web/login', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    // Extract cookies from initial request
    const initialCookies = loginPageResponse.headers['set-cookie'] || [];
    let cookieString = '';
    initialCookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0];
      const cookieValue = cookie.split(';')[0];
      if (cookieString) cookieString += '; ';
      cookieString += cookieValue;
    });
    
    const $ = cheerio.load(loginPageResponse.data);
    let csrfToken = $('input[name="csrf_token"]').attr('value');
    
    // Also try to get from script tag
    if (!csrfToken) {
      const scriptTags = $('script');
      scriptTags.each((i, elem) => {
        const scriptContent = $(elem).html() || '';
        const csrfMatch = scriptContent.match(/csrf_token:\s*["']([^"']+)["']/);
        if (csrfMatch && !csrfToken) {
          csrfToken = csrfMatch[1];
        }
      });
    }
    
    // Try to get from meta tag
    if (!csrfToken) {
      csrfToken = $('meta[name="csrf-token"]').attr('content');
    }
    
    if (!csrfToken) {
      console.error('[Odoo Sync] Could not find CSRF token in login page');
      console.error('[Odoo Sync] Login page HTML snippet:', loginPageResponse.data.substring(0, 1000));
      throw new Error('Could not find CSRF token');
    }
    
    console.log('[Odoo Sync] CSRF token found:', csrfToken.substring(0, 20) + '...');
    
    // Step 2: Login with proper form data
    const loginData = new URLSearchParams({
      login: ODOO_USERNAME,
      password: ODOO_PASSWORD,
      csrf_token: csrfToken,
      redirect: '/web',
    });
    
    const loginResponse = await client.post('/web/login', loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${ODOO_URL}/web/login`,
        'Origin': ODOO_URL,
        'Cookie': cookieString,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 0, // Don't follow redirects automatically
      validateStatus: (status) => status >= 200 && status < 500, // Accept redirects
    });
    
    // Extract all cookies from login response
    const setCookieHeaders = loginResponse.headers['set-cookie'] || [];
    let foundSessionId = null;
    const cookieParts = [];
    
    // Build cookie string and find session_id
    for (const cookie of setCookieHeaders) {
      const cookieValue = cookie.split(';')[0]; // Get cookie name=value part
      cookieParts.push(cookieValue);
      
      if (cookie.startsWith('session_id=')) {
        foundSessionId = cookieValue.split('=')[1];
      }
    }
    
    // Combine with initial cookies
    if (cookieString) {
      cookieParts.push(...cookieString.split('; ').filter(c => c));
    }
    sessionCookies = cookieParts.join('; ');
    
    // Check if login was successful (redirect or dashboard page)
    const isLoginSuccess = 
      loginResponse.status === 302 || 
      loginResponse.status === 303 ||
      (loginResponse.status === 200 && loginResponse.data && !loginResponse.data.includes('oe_login_form'));
    
    if (!isLoginSuccess) {
      console.error('[Odoo Sync] Login appears to have failed');
      console.error('[Odoo Sync] Response status:', loginResponse.status);
      if (loginResponse.data) {
        const htmlSnippet = typeof loginResponse.data === 'string' 
          ? loginResponse.data.substring(0, 500) 
          : JSON.stringify(loginResponse.data).substring(0, 500);
        console.error('[Odoo Sync] Response snippet:', htmlSnippet);
      }
      throw new Error('Login failed - invalid credentials or CSRF token');
    }
    
    if (!foundSessionId) {
      // Try to extract from cookie string
      const sessionMatch = sessionCookies.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        foundSessionId = sessionMatch[1];
      }
    }
    
    if (!foundSessionId) {
      console.error('[Odoo Sync] Could not extract session_id from login response');
      console.error('[Odoo Sync] Response status:', loginResponse.status);
      console.error('[Odoo Sync] Cookies received:', sessionCookies);
      throw new Error('Could not extract session_id from login response');
    }
    
    sessionId = foundSessionId;
    sessionExpiry = Date.now() + (6 * 24 * 60 * 60 * 1000);
    console.log('[Odoo Sync] Login successful, session_id obtained:', sessionId.substring(0, 20) + '...');
    return sessionId;
  } catch (error) {
    console.error('[Odoo Sync] Login error:', error.message);
    if (error.response) {
      console.error('[Odoo Sync] Login response status:', error.response.status);
      console.error('[Odoo Sync] Login response data:', error.response.data?.substring(0, 500));
    }
    throw error;
  }
}

/**
 * Check if session is valid and refresh if needed
 */
export async function ensureAuthenticated() {
  // Check if we have a valid session
  if (sessionId && sessionExpiry && Date.now() < sessionExpiry) {
    return sessionId;
  }
  
  // Session expired or doesn't exist, login again
  console.log('[Odoo Sync] Session expired or missing, re-authenticating...');
  return await loginToOdoo();
}

/**
 * Fetch loyalty cards from Odoo
 */
async function fetchLoyaltyCards() {
  try {
    // Ensure we're authenticated
    const currentSessionId = await ensureAuthenticated();
    
    console.log('[Odoo Sync] Fetching loyalty cards from Odoo...');
    
    // Prepare the request payload (based on the curl command)
    const payload = {
      id: 8,
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "loyalty.card",
        method: "web_search_read",
        args: [],
        kwargs: {
          specification: {
            code: {},
            points: {}
          },
          order: "",
          limit: 10000,
          context: {
            lang: "en_US",
            tz: "Asia/Manila",
            uid: 2,
            allowed_company_ids: [1],
            active_model: "loyalty.program",
            active_id: 24,
            active_ids: [24],
            program_type: "loyalty",
            program_item_name: "Loyalty Cards",
            default_program_id: 24,
            default_mode: "anonymous"
          },
          domain: []
        }
      }
    };
    
    // Make the API call
    // Build cookie string with all necessary cookies
    const apiCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${currentSessionId}; tz=Asia/Manila`;
    
    const response = await client.post('/web/dataset/call_kw/loyalty.card/web_search_read', payload, {
      headers: {
        'Cookie': apiCookieString,
      },
    });
    
    // Check if we got an authentication error
    if (response.data.error && (
      response.data.error.message?.includes('Session expired') ||
      response.data.error.message?.includes('Access denied') ||
      response.status === 401 ||
      response.status === 403
    )) {
      console.log('[Odoo Sync] Session expired during API call, re-authenticating...');
      // Clear session and try again
      sessionId = null;
      sessionExpiry = null;
      sessionCookies = '';
      const newSessionId = await loginToOdoo();
      
      // Retry the request with new session
      const retryCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${newSessionId}; tz=Asia/Manila`;
      const retryResponse = await client.post('/web/dataset/call_kw/loyalty.card/web_search_read', payload, {
        headers: {
          'Cookie': retryCookieString,
        },
      });
      
      return retryResponse.data;
    }
    
    return response.data;
  } catch (error) {
    // If it's an authentication error, try to re-authenticate once
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('[Odoo Sync] Authentication error, re-authenticating...');
      sessionId = null;
      sessionExpiry = null;
      sessionCookies = '';
      const newSessionId = await loginToOdoo();
      
      // Retry the request
      const payload = {
        id: 8,
        jsonrpc: "2.0",
        method: "call",
        params: {
          model: "loyalty.card",
          method: "web_search_read",
          args: [],
          kwargs: {
            specification: {
              code: {},
              points: {}
            },
            order: "",
            limit: 10000,
            context: {
              lang: "en_US",
              tz: "Asia/Manila",
              uid: 2,
              allowed_company_ids: [1],
              active_model: "loyalty.program",
              active_id: 24,
              active_ids: [24],
              program_type: "loyalty",
              program_item_name: "Loyalty Cards",
              default_program_id: 24,
              default_mode: "anonymous"
            },
            domain: []
          }
        }
      };
      
      const retryCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${newSessionId}; tz=Asia/Manila`;
      const retryResponse = await client.post('/web/dataset/call_kw/loyalty.card/web_search_read', payload, {
        headers: {
          'Cookie': retryCookieString,
        },
      });
      
      return retryResponse.data;
    }
    
    throw error;
  }
}

/**
 * Update loyalty card balance in Odoo POS (two-step process)
 * Step 1: Call web_save to create the balance update record
 * Step 2: Call action_update_card_point with the result.id from step 1
 * @param {number} odooCardId - The Odoo card ID (from default_card_id)
 * @param {number} newBalance - The new balance to set
 * @param {string} description - Description for the transaction
 */
export async function updateOdooBalance(odooCardId, newBalance, description) {
  try {
    // Ensure we're authenticated
    const currentSessionId = await ensureAuthenticated();
    
    if (!odooCardId) {
      throw new Error('Odoo card ID is required');
    }
    
    console.log(`[Odoo Sync] Updating balance for card ID: ${odooCardId} to ${newBalance} with description: ${description}`);
    
    // Build cookie string
    const apiCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${currentSessionId}; tz=Asia/Manila`;
    
    // Step 1: Call web_save to create the balance update record
    const step1Payload = {
      id: 13,
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "loyalty.card.update.balance",
        method: "web_save",
        args: [[], {
          new_balance: newBalance,
          description: description || "Balance update"
        }],
        kwargs: {
          context: {
            lang: "en_US",
            tz: "Asia/Manila",
            uid: 2,
            allowed_company_ids: [1],
            params: {
              active_id: 24,
              resId: odooCardId,
              action: 424,
              actionStack: [
                { action: 425 },
                { resId: 24, action: 425 },
                { active_id: 24, action: 424 },
                { active_id: 24, resId: odooCardId, action: 424 }
              ]
            },
            create: false,
            active_model: "loyalty.card",
            active_id: odooCardId,
            active_ids: [odooCardId],
            default_card_id: odooCardId
          },
          specification: {
            card_id: {
              fields: {}
            },
            old_balance: {},
            new_balance: {},
            description: {}
          }
        }
      }
    };
    
    const step1Response = await client.post('/web/dataset/call_kw/loyalty.card.update.balance/web_save', step1Payload, {
      headers: {
        'Cookie': apiCookieString,
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': ODOO_URL,
        'priority': 'u=1, i',
        'referer': `${ODOO_URL}/odoo/action-425/24/action-424/${odooCardId}`,
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status < 500,
    });
    
    // Check for errors in step 1
    if (step1Response.data.error) {
      const errorMsg = step1Response.data.error.message || JSON.stringify(step1Response.data.error);
      console.error('[Odoo Sync] Step 1 (web_save) API error:', errorMsg);
      console.error('[Odoo Sync] Step 1 error details:', JSON.stringify(step1Response.data.error, null, 2));
      throw new Error(`Odoo API error during balance update (step 1): ${errorMsg}`);
    }
    
    // Log step 1 response for debugging
    console.log('[Odoo Sync] Step 1 response:', JSON.stringify(step1Response.data, null, 2));
    
    // Extract result.id from step 1 response
    // Based on Odoo response structure: result[1].id contains the ID we need
    let resultId = null;
    
    if (step1Response.data.result) {
      if (Array.isArray(step1Response.data.result) && step1Response.data.result.length > 1) {
        // Result is an array, get result[1].id
        const secondElement = step1Response.data.result[1];
        if (secondElement && secondElement.id) {
          resultId = secondElement.id;
        } else if (typeof secondElement === 'number') {
          // If result[1] is directly the ID number
          resultId = secondElement;
        }
      } else if (Array.isArray(step1Response.data.result) && step1Response.data.result.length === 1) {
        // Fallback: if only one element, check if it has id
        const firstElement = step1Response.data.result[0];
        if (firstElement && firstElement.id) {
          resultId = firstElement.id;
        } else if (typeof firstElement === 'number') {
          resultId = firstElement;
        }
      } else if (typeof step1Response.data.result === 'number') {
        resultId = step1Response.data.result;
      } else if (step1Response.data.result.id) {
        resultId = step1Response.data.result.id;
      } else if (step1Response.data.result.resId) {
        resultId = step1Response.data.result.resId;
      }
    }
    
    if (!resultId) {
      console.error('[Odoo Sync] Step 1 response structure:', JSON.stringify(step1Response.data, null, 2));
      throw new Error('Could not extract result ID from step 1 response. Expected result[1].id');
    }
    
    // Ensure resultId is a number
    resultId = parseInt(resultId, 10);
    if (isNaN(resultId)) {
      throw new Error(`Invalid result ID extracted: ${resultId}`);
    }
    
    console.log(`[Odoo Sync] Step 1 successful, extracted result ID: ${resultId} (from result[1].id)`);
    
    // Step 2: Call action_update_card_point with the result ID
    // Only args uses resultId, other params still use odooCardId
    const step2Payload = {
      id: 14,
      jsonrpc: "2.0",
      method: "call",
      params: {
        args: [
          [resultId] // Use the result ID from step 1 in args only
        ],
        kwargs: {
          context: {
            params: {
              active_id: 24,
              resId: odooCardId, // Keep using card ID
              action: 424,
              actionStack: [
                { action: 425 },
                { resId: 24, action: 425 },
                { active_id: 24, action: 424 },
                { active_id: 24, resId: odooCardId, action: 424 } // Keep using card ID
              ]
            },
            create: false,
            lang: "en_US",
            tz: "Asia/Manila",
            uid: 2,
            allowed_company_ids: [1],
            active_model: "loyalty.card",
            active_id: odooCardId, // Keep using card ID
            active_ids: [odooCardId], // Keep using card ID
            default_card_id: odooCardId // Keep using card ID
          }
        },
        method: "action_update_card_point",
        model: "loyalty.card.update.balance"
      }
    };
    
    const step2Response = await client.post('/web/dataset/call_button/loyalty.card.update.balance/action_update_card_point', step2Payload, {
      headers: {
        'Cookie': apiCookieString,
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': ODOO_URL,
        'priority': 'u=1, i',
        'referer': `${ODOO_URL}/odoo/action-425/24/action-424/${odooCardId}`,
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status < 500,
    });
    
    // Check for errors in step 2
    if (step2Response.data.error) {
      const errorMsg = step2Response.data.error.message || JSON.stringify(step2Response.data.error);
      const errorData = step2Response.data.error.data || step2Response.data.error;
      console.error('[Odoo Sync] Step 2 (action_update_card_point) API error:', errorMsg);
      console.error('[Odoo Sync] Step 2 error details:', JSON.stringify(errorData, null, 2));
      console.error('[Odoo Sync] Step 2 response status:', step2Response.status);
      console.error('[Odoo Sync] Step 2 payload sent:', JSON.stringify(step2Payload, null, 2));
      throw new Error(`Odoo API error during balance update (step 2): ${errorMsg}`);
    }
    
    // Log successful step 2
    console.log(`[Odoo Sync] Step 2 response:`, JSON.stringify(step2Response.data, null, 2));
    
    console.log(`[Odoo Sync] Successfully updated balance for card ${odooCardId} (both steps completed)`);
    return step2Response.data;
  } catch (error) {
    console.error('[Odoo Sync] Error updating Odoo balance:', error.message);
    throw error;
  }
}

/**
 * Fetch loyalty card history from Odoo to calculate total earned points (sum of all issued points)
 */
async function fetchLoyaltyCardHistoryForTotal(odooCardId) {
  try {
    const currentSessionId = await ensureAuthenticated();
    
    if (!odooCardId) {
      return { totalEarned: 0 };
    }
    
    console.log(`[Odoo Sync] Fetching history for card ID: ${odooCardId} to calculate total earned`);
    
    const payload = {
      id: 6,
      jsonrpc: "2.0",
      method: "call",
      params: {
        model: "loyalty.card",
        method: "web_read",
        args: [[odooCardId]],
        kwargs: {
          context: {
            lang: "en_US",
            tz: "Asia/Manila",
            uid: 2,
            allowed_company_ids: [1],
            bin_size: true,
            active_id: 24,
            active_ids: [24],
            params: {
              active_id: 24,
              resId: odooCardId,
              action: 424,
              actionStack: [
                { action: 425 },
                { resId: 24, action: 425 },
                { active_id: 24, action: 424 },
                { active_id: 24, resId: odooCardId, action: 424 }
              ]
            },
            create: false
          },
          specification: {
            code: {},
            history_ids: {
              fields: {
                issued: {},
                used: {},
                create_date: {},
                description: {},
                order_id: { fields: { display_name: {} } }
              },
              limit: 10000, // Fetch all history entries
              order: "create_date asc"
            },
          }
        }
      }
    };
    
    const apiCookieString = sessionCookies || `frontend_lang=en_US; cids=1; session_id=${currentSessionId}; tz=Asia/Manila`;
    
    const response = await client.post('/web/dataset/call_kw/loyalty.card/web_read', payload, {
      headers: {
        'Cookie': apiCookieString,
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': ODOO_URL,
        'priority': 'u=1, i',
        'referer': `${ODOO_URL}/odoo/action-425/24/action-424/${odooCardId}`,
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status < 500,
    });
    
    if (response.data.error) {
      const errorMsg = response.data.error.message || JSON.stringify(response.data.error);
      console.warn(`[Odoo Sync] Error fetching history for card ${odooCardId}, using current balance as total:`, errorMsg);
      return { totalEarned: 0 };
    }
    
    if (!response.data.result || !response.data.result[0]) {
      console.warn(`[Odoo Sync] No history found for card ID ${odooCardId}`);
      return { totalEarned: 0 };
    }
    
    const cardData = response.data.result[0];
    const history = cardData.history_ids || [];
    
    // Sum all issued points
    const totalEarned = history.reduce((sum, entry) => {
      const issued = entry.issued ? parseFloat(entry.issued) : 0;
      return sum + (isNaN(issued) ? 0 : issued);
    }, 0);
    
    console.log(`[Odoo Sync] Calculated total earned for card ${odooCardId}: ${totalEarned} (sum of ${history.length} history entries)`);
    return { totalEarned };
  } catch (error) {
    console.warn(`[Odoo Sync] Error fetching history for card ${odooCardId}, using current balance as total:`, error.message);
    return { totalEarned: 0 };
  }
}

/**
 * Sync loyalty cards from Odoo to our database
 */
export async function syncLoyaltyCards() {
  try {
    console.log('[Odoo Sync] Starting loyalty cards sync...');
    
    // Fetch loyalty cards from Odoo
    const odooData = await fetchLoyaltyCards();
    
    if (!odooData.result || !odooData.result.records) {
      throw new Error('Invalid response from Odoo API');
    }
    
    const loyaltyCards = odooData.result.records;
    console.log(`[Odoo Sync] Fetched ${loyaltyCards.length} loyalty cards from Odoo`);
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    const updates = [];
    
    // Process each loyalty card
    for (const card of loyaltyCards) {
      try {
        const loyaltyId = card.code || card.loyalty_code || card.loyalty_id;
        const points = parseFloat(card.points || card.points_balance || 0);
        const odooCardId = card.id || card.resId || null; // Store Odoo card ID
        
        if (!loyaltyId) {
          console.warn('[Odoo Sync] Skipping card without loyalty ID:', card);
          continue;
        }
        
        if (isNaN(points) || points < 0) {
          console.warn(`[Odoo Sync] Invalid points value for ${loyaltyId}: ${card.points}`);
          continue;
        }
        
        // Find user by loyalty ID
        const user = await User.findOne({ loyaltyId });
        
        if (!user) {
          notFound++;
          console.log(`[Odoo Sync] User not found for loyalty ID: ${loyaltyId}`);
          continue;
        }
        
        // Update user's espro coins
        const previousBalance = user.esproCoins;
        const previousLifetime = user.lifetimeEsproCoins;
        user.esproCoins = points;
        
        // Store Odoo card ID
        if (odooCardId) {
          user.odooCardId = odooCardId;
          
          // Fetch history to calculate total earned points (sum of all issued points)
          try {
            const historyData = await fetchLoyaltyCardHistoryForTotal(odooCardId);
            if (historyData.totalEarned > 0) {
              user.lifetimeEsproCoins = historyData.totalEarned;
              console.log(`[Odoo Sync] Set total earned for ${loyaltyId}: ${historyData.totalEarned} (sum of all issued points)`);
            } else {
              // If history fetch failed or returned 0, use current balance as fallback if higher
              if (points > user.lifetimeEsproCoins) {
                user.lifetimeEsproCoins = points;
              }
            }
          } catch (error) {
            console.warn(`[Odoo Sync] Failed to fetch history for ${loyaltyId}, using current balance:`, error.message);
            // Fallback: use current balance if higher
            if (points > user.lifetimeEsproCoins) {
              user.lifetimeEsproCoins = points;
            }
          }
        } else {
          // No Odoo card ID, use current balance as fallback if higher
          if (points > user.lifetimeEsproCoins) {
            user.lifetimeEsproCoins = points;
          }
        }
        
        await user.save();
        
        updated++;
        updates.push({
          loyaltyId,
          previousBalance,
          newBalance: points,
          previousLifetime,
          newLifetime: user.lifetimeEsproCoins,
        });
        
        console.log(`[Odoo Sync] Updated ${loyaltyId}: Current ${previousBalance} → ${points} coins, Total Earned ${previousLifetime} → ${user.lifetimeEsproCoins} coins`);
      } catch (error) {
        errors++;
        console.error(`[Odoo Sync] Error processing card:`, error.message);
      }
    }
    
    console.log(`[Odoo Sync] Sync complete: ${updated} updated, ${notFound} not found, ${errors} errors`);
    
    return {
      success: true,
      processed: loyaltyCards.length,
      updated,
      notFound,
      errors,
      updates,
    };
  } catch (error) {
    console.error('[Odoo Sync] Sync error:', error.message);
    throw error;
  }
}

