import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import { formatEsproCoinsDisplay } from '../utils/format';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import useAuthStore from '../store/authStore';

export default function PointsHistory() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const [page, setPage] = useState(1);
  const limit = 10; // Items per page
  
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['points-history', page],
    queryFn: () => customerAPI.getPointsHistory({ page, limit }).then((res) => res.data),
    staleTime: 1 * 60 * 1000, // 1 minute (points history can change)
  });

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['points-history', page]],
    async () => {
      await fetchUser();
    }
  );

  const transactions = historyData?.transactions || [];
  const pagination = historyData?.pagination || { total: 0, page: 1, pages: 1 };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (page < pagination.pages) {
      setPage(page + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Pull to Refresh Indicator */}
      {(isRefreshing || pullDistance > 0) && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-espro-orange text-white py-3 transition-all duration-200"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 60)}px)`,
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 60),
          }}
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Pull to refresh</span>
            </>
          )}
        </div>
      )}
      
      {/* Header */}
      <div className="bg-transparent px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="font-bold text-xl text-gray-900">Points History</div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading history...</div>
        ) : transactions.length > 0 ? (
          <>
            <div className="space-y-3 mb-4">
              {transactions.map((transaction) => {
                const isEarned = transaction.type === 'earned';
                const date = new Date(transaction.createdAt);
                
                return (
                  <div
                    key={transaction._id}
                    className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                      isEarned ? 'border-espro-teal' : 'border-red-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isEarned ? (
                            <svg className="w-5 h-5 text-espro-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          )}
                          <span className={`font-semibold ${isEarned ? 'text-espro-teal' : 'text-red-500'}`}>
                            {isEarned ? 'Earned' : 'Used'}
                          </span>
                        </div>
                        {transaction.description && (
                          <div className="text-sm text-gray-600 mb-1">{transaction.description}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${isEarned ? 'text-espro-teal' : 'text-red-500'}`}>
                          {isEarned ? '+' : '-'}{formatEsproCoinsDisplay(transaction.amount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Balance: {formatEsproCoinsDisplay(transaction.balanceAfter)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePreviousPage}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        page === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-espro-orange text-white hover:bg-orange-600'
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={page >= pagination.pages}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        page >= pagination.pages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-espro-orange text-white hover:bg-orange-600'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">No points history yet</div>
        )}
      </div>
    </div>
  );
}

