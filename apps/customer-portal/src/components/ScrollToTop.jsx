import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Also check mobile-container if it exists
    const container = document.querySelector('.mobile-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

