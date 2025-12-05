/**
 * Format espro coins to 2 decimal places
 * @param {number} coins - The espro coins value
 * @returns {string} Formatted string with 2 decimal places
 */
export function formatEsproCoins(coins) {
  if (coins === null || coins === undefined || isNaN(coins)) {
    return '0.00';
  }
  return parseFloat(coins).toFixed(2);
}

/**
 * Format espro coins for display (removes trailing zeros if whole number)
 * @param {number} coins - The espro coins value
 * @returns {string} Formatted string
 */
export function formatEsproCoinsDisplay(coins) {
  if (coins === null || coins === undefined || isNaN(coins)) {
    return '0';
  }
  const num = parseFloat(coins);
  // If it's a whole number, don't show decimals
  if (num % 1 === 0) {
    return num.toString();
  }
  // Otherwise show 2 decimal places
  return num.toFixed(2);
}

