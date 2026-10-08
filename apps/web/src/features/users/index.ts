// Public API of the "users" feature — the only thing other layers (app/router) may import.
export { createUsersRoutes } from './routes/users.routes';
export { useProfile } from './hooks/use-profile';
export { ProfileView } from './components/profile-view';
export type { Profile } from './api/users.schema';
