import { UserEntity } from '../domain/user.entity';

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export interface UserRepository {
  findById(id: number): Promise<UserEntity | null>;
  save(entity: UserEntity): Promise<UserEntity>;
}
