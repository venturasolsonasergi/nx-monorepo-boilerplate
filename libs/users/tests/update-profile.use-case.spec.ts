import { jest } from '@jest/globals';
import { UpdateProfileUseCase } from '../application/update-profile.use-case';
import {
  ProfileNotFoundError,
  type ProfileRepository,
  type ProfileUpdateData,
} from '../application/profile.repository';
import { ProfileEntity } from '../domain/profile.entity';

function storedProfile(overrides: Partial<ProfileEntity['props']> = {}) {
  return new ProfileEntity({
    id: 1,
    authUserId: 'auth-user-1',
    name: 'Ada',
    surname: 'Lovelace',
    address: '1 Main Street',
    phone: '555-0100',
    ...overrides,
  });
}

describe('UpdateProfileUseCase', () => {
  const updateByAuthUserId =
    jest.fn<
      (
        authUserId: string,
        data: { name: string; surname: string; address: string; phone: string },
      ) => Promise<ProfileEntity>
    >();

  const repository: ProfileRepository = {
    findById: jest.fn(),
    findByAuthUserId: jest.fn(),
    save: jest.fn(),
    updateByAuthUserId,
  };

  const useCase = new UpdateProfileUseCase(repository);

  beforeEach(() => {
    updateByAuthUserId.mockReset();
    updateByAuthUserId.mockImplementation(
      (_authUserId: string, data: ProfileUpdateData) =>
        Promise.resolve(storedProfile({ ...data })),
    );
  });

  it('updates the profile owned by the session identity and returns it', async () => {
    const result = await useCase.execute({
      authUserId: 'auth-user-1',
      name: '  Grace  ',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });

    expect(updateByAuthUserId).toHaveBeenCalledWith('auth-user-1', {
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });
    expect(result).toEqual({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });
  });

  it('propagates ProfileNotFoundError when the identity owns no profile', async () => {
    updateByAuthUserId.mockRejectedValue(new ProfileNotFoundError());

    await expect(
      useCase.execute({
        authUserId: 'auth-user-1',
        name: 'Grace',
        surname: 'Hopper',
        address: '9 Harbor Road',
        phone: '555-0199',
      }),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  it('does not modify the profile when validation fails', async () => {
    await expect(
      useCase.execute({
        authUserId: 'auth-user-1',
        name: '   ',
        surname: 'Hopper',
        address: '9 Harbor Road',
        phone: '555-0199',
      }),
    ).rejects.toThrow(/name must be a non-empty string/);

    expect(updateByAuthUserId).not.toHaveBeenCalled();
  });
});
