import { ProfileEntity } from '../domain/profile.entity';

export class ProfileAlreadyExistsError extends Error {
  constructor() {
    super('Profile already exists');
    this.name = 'ProfileAlreadyExistsError';
  }
}

export interface ProfileRepository {
  findById(id: number): Promise<ProfileEntity | null>;
  save(entity: ProfileEntity): Promise<ProfileEntity>;
}
