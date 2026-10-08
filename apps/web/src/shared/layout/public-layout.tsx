import { Outlet } from '@tanstack/react-router';
import { AppHeader } from './app-header';

// Pathless layout for public pages: the shared, session-aware header plus the
// page content. The dashboard renders its own chrome instead.
export function PublicLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
