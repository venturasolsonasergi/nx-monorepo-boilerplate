import { useEffect, useState } from 'react';

// Breakpoint shared with the sidebar CSS (`md:` utilities). Below this width the
// sidebar renders as an off-canvas sheet instead of a collapsible column.
export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
