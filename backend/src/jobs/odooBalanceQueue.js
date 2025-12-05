import OdooBalanceJob from '../models/OdooBalanceJob.js';

// MongoDB-based job queue for Odoo balance updates
class OdooBalanceQueue {
  // Add job to queue (saves to MongoDB)
  async addJob(odooCardId, newBalance, description) {
    try {
      const job = await OdooBalanceJob.create({
        odooCardId,
        newBalance,
        description,
        status: 'pending',
      });
      
      console.log(`[Odoo Balance Queue] Job added to MongoDB: ${job._id} for card ${odooCardId}`);
      return job._id;
    } catch (error) {
      console.error('[Odoo Balance Queue] Error adding job:', error.message);
      throw error;
    }
  }

  // Get queue status
  async getStatus() {
    try {
      const pending = await OdooBalanceJob.countDocuments({ status: 'pending' });
      const processing = await OdooBalanceJob.countDocuments({ status: 'processing' });
      const completed = await OdooBalanceJob.countDocuments({ status: 'completed' });
      const failed = await OdooBalanceJob.countDocuments({ status: 'failed' });
      
      return {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed,
      };
    } catch (error) {
      console.error('[Odoo Balance Queue] Error getting status:', error.message);
      return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    }
  }
}

// Export singleton instance
export default new OdooBalanceQueue();

