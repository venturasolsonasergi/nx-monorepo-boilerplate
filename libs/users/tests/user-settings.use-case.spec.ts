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
    upsert.mockImplementation((entity) =>
      Promise.resolve(
        new UserSettingsEntity({
          id: 2,
          authUserId: entity.props.authUserId,
          language: entity.props.language,
          theme: entity.props.theme,
        }),
      ),
    );
  });

  it('returns the stored language and theme for the session identity', async () => {
    findByAuthUserId.mockResolvedValue(
      new UserSettingsEntity({
        id: 1,
        authUserId: 'auth-user-1',
        language: 'ca',
        theme: 'dark',
      }),
    );

    await expect(getSettings.execute('auth-user-1')).resolves.toEqual({
      language: 'ca',
      theme: 'dark',
    });
    expect(findByAuthUserId).toHaveBeenCalledWith('auth-user-1');
  });

  it('throws UserSettingsNotFoundError when the identity has no settings', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(getSettings.execute('auth-user-1')).rejects.toBeInstanceOf(
      UserSettingsNotFoundError,
    );
  });

  it('creates settings with the selected language and theme', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(
      updateSettings.execute({
        authUserId: 'auth-user-1',
        language: 'en',
        theme: 'dark',
      }),
    ).resolves.toEqual({ language: 'en', theme: 'dark' });

    expect(upsert).toHaveBeenCalledTimes(1);
    const entity = upsert.mock.calls[0][0];
    expect(entity.props.authUserId).toBe('auth-user-1');
    expect(entity.props.language).toBe('en');
    expect(entity.props.theme).toBe('dark');
  });

  it('defaults the theme to system when creating settings without a theme', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(
      updateSettings.execute({ authUserId: 'auth-user-1', language: 'en' }),
    ).resolves.toEqual({ language: 'en', theme: 'system' });

    expect(upsert).toHaveBeenCalledTimes(1);
    const entity = upsert.mock.calls[0][0];
    expect(entity.props.theme).toBe('system');
  });

  it('preserves the stored theme when only the language is provided', async () => {
    findByAuthUserId.mockResolvedValue(
      new UserSettingsEntity({
        id: 1,
        authUserId: 'auth-user-1',
        language: 'ca',
        theme: 'dark',
      }),
    );

    await expect(
      updateSettings.execute({ authUserId: 'auth-user-1', language: 'en' }),
    ).resolves.toEqual({ language: 'en', theme: 'dark' });

    const entity = upsert.mock.calls[0][0];
    expect(entity.props.language).toBe('en');
    expect(entity.props.theme).toBe('dark');
  });

  it('updates only the theme when the language is unchanged', async () => {
    findByAuthUserId.mockResolvedValue(
      new UserSettingsEntity({
        id: 1,
        authUserId: 'auth-user-1',
        language: 'ca',
        theme: 'light',
      }),
    );

    await expect(
      updateSettings.execute({
        authUserId: 'auth-user-1',
        language: 'ca',
        theme: 'dark',
      }),
    ).resolves.toEqual({ language: 'ca', theme: 'dark' });

    const entity = upsert.mock.calls[0][0];
    expect(entity.props.theme).toBe('dark');
  });

  it('rejects an unsupported language before persisting', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(
      updateSettings.execute({ authUserId: 'auth-user-1', language: 'fr' }),
    ).rejects.toThrow();

    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects an unsupported theme before persisting', async () => {
    findByAuthUserId.mockResolvedValue(null);

    await expect(
      updateSettings.execute({
        authUserId: 'auth-user-1',
        language: 'en',
        theme: 'sepia',
      }),
    ).rejects.toThrow();

    expect(upsert).not.toHaveBeenCalled();
  });
});
