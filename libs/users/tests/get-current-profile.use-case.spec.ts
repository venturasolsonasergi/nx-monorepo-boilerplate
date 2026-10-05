import { jest } from '@jest/globals';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import {
  ProfileNotFoundError,
  type ProfileRepository,
} from '../application/profile.repository';
import { ProfileEntity } from '../domain/profile.entity';

describe('GetCurrentProfileUseCase', () => {
  const findByAuthUserId =
    jest.fn<(authUserId: string) => Promise<ProfileEntity | null>>();

  const repository: ProfileRepository = {
    findById: jest.fn(),
    findByAuthUserId,
    save: jest.fn(),
  };

  const useCase = new GetCurrentProfileUseCase(repository);

  beforeEach(() => {
    findByAuthUserId.mockReset();
  });

  it('returns the profile as a flat object with a mandatory id', async () => {
    findByAuthUserId.mockResolvedValue(
      new ProfileEntity({
        id: 1,
        authUserId: 'auth-user-1',
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      }),
    );

    const result = await useCase.execute('auth-user-1');

    expect(findByAuthUserId).toHaveBeenCalledWith('auth-user-1');
    expect(result).toEqual({
      id: 1,
      authUserId: 'auth-user-1',
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    });
    expect(result).not.toHaveProperty('props');
  });

  it('throws ProfileNotFoundError when the identity has no profile', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(useCase.execute('auth-user-1')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});
