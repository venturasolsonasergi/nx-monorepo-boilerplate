export interface RequestContext {
  sourceIp: string | null;
}

export const UNKNOWN_REQUEST_CONTEXT: RequestContext = { sourceIp: null };
