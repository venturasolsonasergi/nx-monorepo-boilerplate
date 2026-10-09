import type { ProfileRepository } from './profile.repository';
import { ProfileEntity } from '../domain/profile.entity';
import { AuthUserIdValueObject } from '../domain/auth-user-id.vo';

export interface UpdateProfileInput {
  authUserId: string;
  name: string;
  surname: string;
  address: string;
  phone: string;
}

export type UpdateProfileOutput = ProfileEntity['props'] & { id: number };

export class UpdateProfileUseCase {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(input: UpdateProfileInput): Promise<UpdateProfileOutput> {
    const authUserId = new AuthUserIdValueObject(input.authUserId);
    const profile = new ProfileEntity({
      authUserId: authUserId.value,
      name: input.name.trim(),
      surname: input.surname.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
    });

    const persistedProfile = await this.repository.updateByAuthUserId(
      authUserId.value,
      {
        name: profile.props.name,
        surname: profile.props.surname,
        address: profile.props.address,
        phone: profile.props.phone,
      },
    );

    if (persistedProfile.props.id === undefined) {
      throw new Error('Persisted profile must have an id');
    }

    return { ...persistedProfile.props, id: persistedProfile.props.id };
  }
}
