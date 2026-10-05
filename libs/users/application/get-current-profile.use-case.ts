import type { ProfileRepository } from './profile.repository';
import { ProfileNotFoundError } from './profile.repository';
import type { ProfileEntity } from '../domain/profile.entity';

export type GetCurrentProfileOutput = ProfileEntity['props'] & { id: number };

export class GetCurrentProfileUseCase {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(authUserId: string): Promise<GetCurrentProfileOutput> {
    const profile = await this.repository.findByAuthUserId(authUserId);

    if (!profile) {
      throw new ProfileNotFoundError();
    }

    if (profile.props.id === undefined) {
      throw new Error('Persisted profile must have an id');
    }

    return { ...profile.props, id: profile.props.id };
  }
}
