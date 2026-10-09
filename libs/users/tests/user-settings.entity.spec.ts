import { UserSettingsEntity } from '../domain/user-settings.entity';

describe('UserSettingsEntity', () => {
  it('accepts each supported theme', () => {
    for (const theme of ['light', 'dark', 'system']) {
      const entity = new UserSettingsEntity({
        authUserId: 'auth-user-1',
        language: 'ca',
        theme,
      });

      expect(entity.props.theme).toBe(theme);
    }
  });

  it('rejects a theme outside the supported set', () => {
    expect(
      () =>
        new UserSettingsEntity({
          authUserId: 'auth-user-1',
          language: 'ca',
          theme: 'sepia',
        }),
    ).toThrow('Unsupported theme: sepia');
  });

  it('normalizes a padded theme value', () => {
    const entity = new UserSettingsEntity({
      authUserId: 'auth-user-1',
      language: 'ca',
      theme: ' dark ',
    });

    expect(entity.props.theme).toBe('dark');
  });

  it('still validates the language alongside the theme', () => {
    expect(
      () =>
        new UserSettingsEntity({
          authUserId: 'auth-user-1',
          language: 'fr',
          theme: 'dark',
        }),
    ).toThrow('Unsupported language: fr');
  });
});
