import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePullToRefresh(queryKeys = [], onRefresh) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(null);
  const currentY = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const container = document.querySelector('.mobile-container');
    if (!container) return;

    let isDragging = false;

    const getY = (e) => {
      if (e.touches && e.touches.length > 0) {
        return e.touches[0].clientY;
      }
      return e.clientY;
    };

    const handleStart = (e) => {
      // Only trigger if at the top of the scroll
      if (container.scrollTop === 0) {
        startY.current = getY(e);
        currentY.current = startY.current;
        isDragging = true;
      }
    };

    const handleMove = (e) => {
      if (!isDragging || startY.current === null) return;
      
      currentY.current = getY(e);
      const distance = currentY.current - startY.current;
      
      // Only allow pull down (positive distance)
      if (distance > 0 && container.scrollTop === 0) {
        e.preventDefault(); // Prevent default scroll
        const pullDistance = Math.min(distance, 100); // Max 100px pull
        setPullDistance(pullDistance);
      }
    };

    const handleEnd = async () => {
      if (!isDragging || startY.current === null) {
        isDragging = false;
        return;
      }
      
      const distance = currentY.current - startY.current;
      
      // Trigger refresh if pulled down more than 60px
      if (distance > 60 && container.scrollTop === 0) {
        setIsRefreshing(true);
        setPullDistance(0);
        
        try {
          // Refetch all specified query keys
          const refetchPromises = queryKeys.map(key => 
            queryClient.refetchQueries({ queryKey: key })
          );
          
          // Also call custom refresh handler if provided
          if (onRefresh) {
            await onRefresh();
          }
          
          await Promise.all(refetchPromises);
        } catch (error) {
          console.error('Error refreshing:', error);
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
      
      startY.current = null;
      currentY.current = null;
      isDragging = false;
    };

    // Touch events (mobile)
    container.addEventListener('touchstart', handleStart, { passive: false });
    container.addEventListener('touchmove', handleMove, { passive: false });
    container.addEventListener('touchend', handleEnd);
    container.addEventListener('touchcancel', handleEnd);

    // Mouse events (desktop - for testing)
    container.addEventListener('mousedown', handleStart);
    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseup', handleEnd);
    container.addEventListener('mouseleave', handleEnd);

    return () => {
      container.removeEventListener('touchstart', handleStart);
      container.removeEventListener('touchmove', handleMove);
      container.removeEventListener('touchend', handleEnd);
      container.removeEventListener('touchcancel', handleEnd);
      container.removeEventListener('mousedown', handleStart);
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseup', handleEnd);
      container.removeEventListener('mouseleave', handleEnd);
    };
  }, [queryKeys, onRefresh, queryClient]);

  return { isRefreshing, pullDistance };
}

