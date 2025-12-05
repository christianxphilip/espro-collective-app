import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePullToRefresh(queryKeys = [], onRefresh) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(null);
  const currentY = useRef(null);
  const queryClient = useQueryClient();
  const containerRef = useRef(null);

  useEffect(() => {
    // Try to find the mobile-container, or use window/body as fallback
    const container = document.querySelector('.mobile-container') || window;
    containerRef.current = container;

    let isDragging = false;
    let initialScrollY = 0;

    const getY = (e) => {
      if (e.touches && e.touches.length > 0) {
        return e.touches[0].clientY;
      }
      return e.clientY;
    };

    const getScrollTop = () => {
      if (container === window) {
        return window.scrollY || window.pageYOffset || 0;
      }
      return container.scrollTop || 0;
    };

    const handleStart = (e) => {
      // Only trigger if at the top of the scroll (allow small tolerance)
      initialScrollY = getScrollTop();
      if (initialScrollY <= 5) {
        startY.current = getY(e);
        currentY.current = startY.current;
        isDragging = true;
      }
    };

    const handleMove = (e) => {
      if (!isDragging || startY.current === null) return;
      
      // Check if still at top (allow small scroll tolerance)
      if (getScrollTop() > 5) {
        isDragging = false;
        setPullDistance(0);
        return;
      }
      
      currentY.current = getY(e);
      const distance = currentY.current - startY.current;
      
      // Only allow pull down (positive distance)
      if (distance > 0) {
        e.preventDefault(); // Prevent default scroll
        // Make it more sensitive - amplify the pull distance slightly
        const amplifiedDistance = distance * 1.2;
        const pullDistance = Math.min(amplifiedDistance, 120); // Max 120px pull
        setPullDistance(pullDistance);
      } else {
        setPullDistance(0);
      }
    };

    const handleEnd = async () => {
      if (!isDragging || startY.current === null) {
        isDragging = false;
        setPullDistance(0);
        return;
      }
      
      const distance = currentY.current - startY.current;
      
      // Trigger refresh if pulled down more than 40px (reduced from 60px) and still at top
      if (distance > 40 && getScrollTop() <= 5) {
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

    // Touch events (mobile) - attach to document for better detection
    document.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    // Mouse events (desktop - for testing)
    document.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      document.removeEventListener('mousedown', handleStart);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [queryKeys, onRefresh, queryClient]);

  return { isRefreshing, pullDistance };
}

