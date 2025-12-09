import ActivityLog from '../models/ActivityLog.js';

/**
 * Log an activity
 * @param {string} type - Activity type (odoo_sync, odoo_customer_sync, odoo_voucher_sync, odoo_balance_update)
 * @param {string} status - Status (success, error, warning)
 * @param {string} message - Log message
 * @param {object} details - Additional details (sync results, error details, etc.)
 * @param {object} metadata - Optional metadata
 * @returns {Promise<ActivityLog>}
 */
export async function logActivity(type, status, message, details = {}, metadata = {}) {
  try {
    const log = await ActivityLog.create({
      type,
      status,
      message,
      details,
      metadata,
    });
    return log;
  } catch (error) {
    console.error('[ActivityLog] Error creating activity log:', error.message);
    throw error;
  }
}

/**
 * Get activity logs with filters and pagination
 * @param {object} filters - Filter options (type, status, dateRange)
 * @param {object} pagination - Pagination options (page, limit)
 * @returns {Promise<{logs: ActivityLog[], total: number, page: number, limit: number, totalPages: number}>}
 */
export async function getActivityLogs(filters = {}, pagination = {}) {
  try {
    const {
      type,
      status,
      startDate,
      endDate,
    } = filters;

    const {
      page = 1,
      limit = 50,
    } = pagination;

    // Build query
    const query = {};

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate skip
    const skip = (page - 1) * limit;

    // Get logs and total count
    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    console.error('[ActivityLog] Error fetching activity logs:', error.message);
    throw error;
  }
}

/**
 * Get sync statistics
 * @returns {Promise<object>}
 */
export async function getSyncStatistics() {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get last sync times for each type
    const lastSyncs = await ActivityLog.aggregate([
      {
        $match: {
          status: 'success',
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$type',
          lastSync: { $first: '$createdAt' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get success/error counts for last 24 hours
    const recentStats = await ActivityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours },
        },
      },
      {
        $group: {
          _id: { type: '$type', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get error rate for last 7 days
    const errorRate = await ActivityLog.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Format results
    const lastSyncMap = {};
    lastSyncs.forEach(item => {
      lastSyncMap[item._id] = {
        lastSync: item.lastSync,
        totalSyncs: item.count,
      };
    });

    const recentStatsMap = {};
    recentStats.forEach(item => {
      const key = `${item._id.type}_${item._id.status}`;
      recentStatsMap[key] = item.count;
    });

    const totalErrors = errorRate.find(e => e._id === 'error')?.count || 0;
    const totalSuccess = errorRate.find(e => e._id === 'success')?.count || 0;
    const totalWarnings = errorRate.find(e => e._id === 'warning')?.count || 0;
    const total = totalErrors + totalSuccess + totalWarnings;
    const errorRatePercent = total > 0 ? ((totalErrors / total) * 100).toFixed(2) : 0;

    return {
      lastSyncs: lastSyncMap,
      recentStats: recentStatsMap,
      errorRate: {
        percent: parseFloat(errorRatePercent),
        totalErrors,
        totalSuccess,
        totalWarnings,
        total,
      },
    };
  } catch (error) {
    console.error('[ActivityLog] Error fetching sync statistics:', error.message);
    throw error;
  }
}

