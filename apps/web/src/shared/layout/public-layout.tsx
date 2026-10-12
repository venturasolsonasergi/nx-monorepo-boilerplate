import { Outlet } from '@tanstack/react-router';
import { AppHeader } from './app-header';

// Pathless layout for public pages: the shared, session-aware header plus the
// page content, centered vertically when it is shorter than the viewport. The
// dashboard renders its own chrome instead.
export function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <div className="flex flex-1 items-center justify-center">
        <Outlet />
      </div>
    </div>
  );
}
