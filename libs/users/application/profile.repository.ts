import { ProfileEntity } from '../domain/profile.entity';

export class ProfileAlreadyExistsError extends Error {
  constructor() {
    super('Profile already exists');
    this.name = 'ProfileAlreadyExistsError';
  }
}

export class ProfileNotFoundError extends Error {
  constructor() {
    super('Profile not found');
    this.name = 'ProfileNotFoundError';
  }
}

export interface ProfileRepository {
  findById(id: number): Promise<ProfileEntity | null>;
  findByAuthUserId(authUserId: string): Promise<ProfileEntity | null>;
  save(entity: ProfileEntity): Promise<ProfileEntity>;
}
