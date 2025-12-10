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
    // Find the scrollable container
    const container = document.querySelector('.mobile-container') || document.documentElement || document.body;
    containerRef.current = container;

    let isDragging = false;
    let initialScrollY = 0;
    let hasScrolled = false;
    let touchStartY = 0;

    const getY = (e) => {
      if (e.touches && e.touches.length > 0) {
        return e.touches[0].clientY;
      }
      if (e.changedTouches && e.changedTouches.length > 0) {
        return e.changedTouches[0].clientY;
      }
      return e.clientY;
    };

    const getScrollTop = () => {
      if (container === document.documentElement || container === document.body) {
        return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      }
      return container.scrollTop || 0;
    };

    const handleStart = (e) => {
      // Only trigger if at the top of the scroll (allow tolerance)
      initialScrollY = getScrollTop();
      hasScrolled = false;
      
      if (initialScrollY <= 20) {
        touchStartY = getY(e);
        startY.current = touchStartY;
        currentY.current = touchStartY;
        isDragging = true;
      }
    };

    const handleMove = (e) => {
      if (!isDragging || startY.current === null) return;
      
      const currentScroll = getScrollTop();
      const currentYPos = getY(e);
      
      // Check if user scrolled down (not pulling)
      if (currentScroll > initialScrollY + 15) {
        hasScrolled = true;
        isDragging = false;
        setPullDistance(0);
        return;
      }
      
      // Check if still at top (allow tolerance)
      if (currentScroll > 20) {
        isDragging = false;
        setPullDistance(0);
        return;
      }
      
      currentY.current = currentYPos;
      const distance = currentY.current - startY.current;
      
      // Only allow pull down (positive distance)
      if (distance > 0 && !hasScrolled) {
        // Prevent default scroll behavior
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Make it more sensitive - amplify the pull distance
        const amplifiedDistance = distance * 2.2;
        const pullDistance = Math.min(amplifiedDistance, 150); // Max 150px pull
        setPullDistance(pullDistance);
      } else {
        setPullDistance(0);
      }
    };

    const handleEnd = async () => {
      if (!isDragging || startY.current === null) {
        isDragging = false;
        setPullDistance(0);
        startY.current = null;
        currentY.current = null;
        hasScrolled = false;
        return;
      }
      
      const distance = currentY.current - startY.current;
      const currentScroll = getScrollTop();
      
      // Trigger refresh if pulled down more than 15px and still at top
      if (distance > 15 && currentScroll <= 20 && !hasScrolled) {
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
          if (import.meta.env.DEV) {
            console.error('Error refreshing:', error);
          }
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
      
      startY.current = null;
      currentY.current = null;
      isDragging = false;
      hasScrolled = false;
    };

    // Attach listeners to both document and container for better coverage
    const attachListeners = (target) => {
      target.addEventListener('touchstart', handleStart, { passive: false });
      target.addEventListener('touchmove', handleMove, { passive: false });
      target.addEventListener('touchend', handleEnd);
      target.addEventListener('touchcancel', handleEnd);
      target.addEventListener('mousedown', handleStart);
      target.addEventListener('mousemove', handleMove);
      target.addEventListener('mouseup', handleEnd);
    };

    const removeListeners = (target) => {
      target.removeEventListener('touchstart', handleStart);
      target.removeEventListener('touchmove', handleMove);
      target.removeEventListener('touchend', handleEnd);
      target.removeEventListener('touchcancel', handleEnd);
      target.removeEventListener('mousedown', handleStart);
      target.removeEventListener('mousemove', handleMove);
      target.removeEventListener('mouseup', handleEnd);
    };

    // Attach to both document and container
    attachListeners(document);
    if (container && container !== document) {
      attachListeners(container);
    }

    return () => {
      removeListeners(document);
      if (container && container !== document) {
        removeListeners(container);
      }
    };
  }, [queryKeys, onRefresh, queryClient]);

  return { isRefreshing, pullDistance };
}
