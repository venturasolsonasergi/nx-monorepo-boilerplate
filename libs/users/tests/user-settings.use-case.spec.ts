import { jest } from '@jest/globals';
import { GetUserSettingsUseCase } from '../application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/update-user-settings.use-case';
import {
  UserSettingsNotFoundError,
  type UserSettingsRepository,
} from '../application/user-settings.repository';
import { UserSettingsEntity } from '../domain/user-settings.entity';

describe('user settings use cases', () => {
  const findByAuthUserId =
    jest.fn<(authUserId: string) => Promise<UserSettingsEntity | null>>();
  const upsert =
    jest.fn<(entity: UserSettingsEntity) => Promise<UserSettingsEntity>>();

  const repository: UserSettingsRepository = { findByAuthUserId, upsert };

  const getSettings = new GetUserSettingsUseCase(repository);
  const updateSettings = new UpdateUserSettingsUseCase(repository);

  beforeEach(() => {
    findByAuthUserId.mockReset();
    upsert.mockReset();
  });

  it('returns the stored language for the session identity', async () => {
    findByAuthUserId.mockResolvedValue(
      new UserSettingsEntity({
        id: 1,
        authUserId: 'auth-user-1',
        language: 'ca',
      }),
    );

    await expect(getSettings.execute('auth-user-1')).resolves.toEqual({
      language: 'ca',
    });
    expect(findByAuthUserId).toHaveBeenCalledWith('auth-user-1');
  });

  it('throws UserSettingsNotFoundError when the identity has no settings', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(getSettings.execute('auth-user-1')).rejects.toBeInstanceOf(
      UserSettingsNotFoundError,
    );
  });

  it('upserts the selected language for the session identity', async () => {
    upsert.mockImplementation((entity) =>
      Promise.resolve(
        new UserSettingsEntity({
          id: 2,
          authUserId: entity.props.authUserId,
          language: entity.props.language,
        }),
      ),
    );

    await expect(
      updateSettings.execute({ authUserId: 'auth-user-1', language: 'en' }),
    ).resolves.toEqual({ language: 'en' });

    expect(upsert).toHaveBeenCalledTimes(1);
    const entity = upsert.mock.calls[0][0];
    expect(entity.props.authUserId).toBe('auth-user-1');
    expect(entity.props.language).toBe('en');
  });

  it('rejects an unsupported language before persisting', async () => {
    await expect(
      updateSettings.execute({ authUserId: 'auth-user-1', language: 'fr' }),
    ).rejects.toThrow();

    expect(upsert).not.toHaveBeenCalled();
  });
});
