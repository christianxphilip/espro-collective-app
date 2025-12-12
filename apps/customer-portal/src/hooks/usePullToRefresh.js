import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PullToRefresh from 'pulltorefreshjs';

// Global instance - only one pull-to-refresh should exist
let globalPtrInstance = null;
let globalRefreshCallbacks = new Set();

export function usePullToRefresh(queryKeys = [], onRefresh) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const callbackRef = useRef(null);

  useEffect(() => {
    // Store the callback for this hook instance
    callbackRef.current = { queryKeys, onRefresh, queryClient, setIsRefreshing };

    // Initialize global pull-to-refresh if it doesn't exist
    if (!globalPtrInstance) {
      globalPtrInstance = PullToRefresh.init({
        mainElement: 'body',
        triggerElement: 'body',
        onRefresh: async (resolve) => {
          // Call all registered callbacks
          const promises = Array.from(globalRefreshCallbacks).map(async (cb) => {
            if (cb && cb.setIsRefreshing) {
              cb.setIsRefreshing(true);
            }
            
            try {
              // Refetch all specified query keys
              if (cb && cb.queryKeys) {
                const refetchPromises = cb.queryKeys.map(key => 
                  cb.queryClient.refetchQueries({ queryKey: key })
                );
                await Promise.all(refetchPromises);
              }
              
              // Also call custom refresh handler if provided
              if (cb && cb.onRefresh) {
                await cb.onRefresh();
              }
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error('Error refreshing:', error);
              }
            } finally {
              if (cb && cb.setIsRefreshing) {
                cb.setIsRefreshing(false);
              }
            }
          });
          
          await Promise.all(promises);
          // Resolve the pull-to-refresh animation
          resolve();
        },
        // Customize the appearance
        instructionsPullToRefresh: 'Pull down to refresh',
        instructionsReleaseToRefresh: 'Release to refresh',
        instructionsRefreshing: 'Refreshing...',
        // Make it more sensitive - lower thresholds for easier triggering
        distThreshold: 40,
        distMax: 80,
        distReload: 40,
        // Better mobile support
        shouldPullToRefresh: () => {
          // Only allow pull-to-refresh when at the top of the page
          const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          // Also check mobile-container if it exists
          const container = document.querySelector('.mobile-container');
          const containerScroll = container ? container.scrollTop || 0 : 0;
          return scrollTop === 0 && containerScroll === 0;
        },
        // Custom icon (optional - uses default if not provided)
        iconArrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>',
        iconRefreshing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>',
      });
    }

    // Register this hook's callback
    globalRefreshCallbacks.add(callbackRef.current);

    // Cleanup
    return () => {
      // Remove this hook's callback
      globalRefreshCallbacks.delete(callbackRef.current);
      
      // If no more callbacks, destroy the global instance
      if (globalRefreshCallbacks.size === 0 && globalPtrInstance) {
        globalPtrInstance.destroy();
        globalPtrInstance = null;
      }
    };
  }, [queryKeys, onRefresh, queryClient]);

  return { isRefreshing };
}
