import type { ProfileRepository } from './profile.repository';
import { ProfileEntity } from '../domain/profile.entity';
import { AuthUserIdValueObject } from '../domain/auth-user-id.vo';

export interface CreateProfileInput {
  authUserId: string;
  name: string;
  surname: string;
  address: string;
  phone: string;
}

export type CreateProfileOutput = ProfileEntity['props'] & { id: number };

export class CreateProfileUseCase {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(input: CreateProfileInput): Promise<CreateProfileOutput> {
    const authUserId = new AuthUserIdValueObject(input.authUserId);
    const profile = new ProfileEntity({
      authUserId: authUserId.value,
      name: input.name.trim(),
      surname: input.surname.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
    });
    const persistedProfile = await this.repository.save(profile);

    if (persistedProfile.props.id === undefined) {
      throw new Error('Persisted profile must have an id');
    }

    return { ...persistedProfile.props, id: persistedProfile.props.id };
  }
}
