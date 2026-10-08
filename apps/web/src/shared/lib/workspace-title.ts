export interface WorkspaceRouteMeta {
  workspaceTitle?: string;
}

export const DEFAULT_WORKSPACE_TITLE = 'workspace.defaultTitle';

interface MatchWithStaticData {
  staticData?: unknown;
}

// Resolves the compact-header title from route metadata: the deepest matched
// route that declares `staticData.workspaceTitle` wins. Adding a new workspace
// route therefore needs no change here.
export function workspaceTitleFromMatches(
  matches: ReadonlyArray<MatchWithStaticData>,
): string {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const data = matches[index].staticData;
    if (data && typeof data === 'object' && 'workspaceTitle' in data) {
      const title = (data as WorkspaceRouteMeta).workspaceTitle;
      if (typeof title === 'string' && title.length > 0) {
        return title;
      }
    }
  }

  return DEFAULT_WORKSPACE_TITLE;
}
