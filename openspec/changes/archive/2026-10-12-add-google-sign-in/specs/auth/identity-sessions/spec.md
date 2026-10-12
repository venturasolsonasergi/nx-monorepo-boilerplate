# Spec Delta: auth/identity-sessions

## MODIFIED Requirements

### Requirement: Publish the support contact
The service SHALL expose `GET /auth/public-config` returning the configured public support email (`supportEmail`, null when unconfigured) and `allowedProviders`, the list of configured social provider identifiers (for example `["google"]`), so clients can offer help when registration mail is not received and render only the sign-in options the service can serve. The contact SHALL be configured by `AUTH_SUPPORT_EMAIL`, validated as an email when present, and required in production. A provider SHALL appear in `allowedProviders` only when its client credentials are configured at startup. Public configuration SHALL NOT contain SMTP credentials, auth secrets, tokens, or private account data.

#### Scenario: Configured support contact
- **WHEN** a client requests public auth configuration in a configured deployment
- **THEN** it receives the public support email without any secrets or account data

#### Scenario: Configured support contact and providers
- **WHEN** a client requests public auth configuration in a deployment with a support email and Google credentials configured
- **THEN** it receives the support email and `allowedProviders` including `google`, without any secrets or account data

#### Scenario: No social provider configured
- **WHEN** a client requests public auth configuration in a deployment without any social provider credentials
- **THEN** it receives `allowedProviders` as an empty list and the response remains a valid public configuration

#### Scenario: Invalid or missing production support contact
- **WHEN** the service starts with an invalid configured support email or no support email in production
- **THEN** configuration validation fails with an actionable configuration error
