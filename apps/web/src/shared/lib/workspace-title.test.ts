import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_TITLE,
  workspaceTitleFromMatches,
} from './workspace-title';

describe('workspaceTitleFromMatches', () => {
  it('uses the deepest route that declares a workspace title', () => {
    expect(
      workspaceTitleFromMatches([
        { staticData: { workspaceTitle: 'Panel' } },
        { staticData: { workspaceTitle: 'Mi perfil' } },
      ]),
    ).toBe('Mi perfil');
  });

  it('falls back to the default when no route declares a title', () => {
    expect(workspaceTitleFromMatches([{ staticData: {} }, {}])).toBe(
      DEFAULT_WORKSPACE_TITLE,
    );
  });

  it('ignores malformed titles', () => {
    expect(
      workspaceTitleFromMatches([
        { staticData: { workspaceTitle: 42 } },
        { staticData: { workspaceTitle: '' } },
      ]),
    ).toBe(DEFAULT_WORKSPACE_TITLE);
  });
});
