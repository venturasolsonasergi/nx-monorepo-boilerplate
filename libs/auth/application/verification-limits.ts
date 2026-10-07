export interface VerificationLimits {
  resendWindowSeconds: number;
  sourceWindowSeconds: number;
  sourceMax: number;
  retentionSeconds: number;
}

export const DEFAULT_VERIFICATION_LIMITS: VerificationLimits = {
  resendWindowSeconds: 60,
  sourceWindowSeconds: 3600,
  sourceMax: 20,
  retentionSeconds: 86400,
};
