# Spec Delta

## REMOVED Requirements

### Requirement: Reject failed browser API responses
**Reason**: Describes an internal browser API client contract (credentials, status exposure, and schema validation) rather than user-observable behavior; it is asserted by web unit tests instead of a behavioral spec.
**Migration**: No user-visible change. The browser API client continues to reject non-2xx responses and invalid payloads; coverage remains in `apps/web/src/shared/lib/api-client.test.ts`.
