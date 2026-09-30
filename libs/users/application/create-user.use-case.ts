import type { UserRepository } from './user.repository';
import { UserEntity } from '../domain/user.entity';
import { UserEmailValueObject } from '../domain/user.vo';

export interface CreateUserInput {
  name: string;
  surname: string;
  email: string;
  address: string;
  phone: string;
}

export type CreateUserOutput = UserEntity['props'] & { id: number };

export class CreateUserUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    const email = new UserEmailValueObject(input.email);
    const user = new UserEntity({
      name: input.name.trim(),
      surname: input.surname.trim(),
      email: email.value,
      address: input.address.trim(),
      phone: input.phone.trim(),
    });
    const persistedUser = await this.repository.save(user);

    if (persistedUser.props.id === undefined) {
      throw new Error('Persisted user must have an id');
    }

    return { ...persistedUser.props, id: persistedUser.props.id };
  }
}
