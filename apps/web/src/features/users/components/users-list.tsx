import type { User } from '../api/users.schema';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../shared/ui/card';

interface UsersListProps {
  users: User[];
}

// Pure presentational component — no data fetching, only rendering.
export function UsersList({ users }: UsersListProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No hay usuarios todavía.</p>
    );
  }

  return (
    <div className="grid gap-3">
      {users.map((user) => (
        <Card key={user.id}>
          <CardHeader>
            <CardTitle>{user.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {user.email}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
