# Spec Delta

## Purpose

Let the browser client present its interface in one of several supported languages, carried in the URL and, for a signed-in user, remembered with their account.

## ADDED Requirements

### Requirement: Serve every route in the active locale
The web client SHALL present its user-facing copy in the active locale and SHALL serve every implemented route under a locale prefix selected from `es`, `en`, and `ca` (for example `/es/login`). It SHALL keep all in-app navigation within the active locale prefix. Copy SHALL be resolved from per-locale resources so that no user-facing string is fixed to a single language.

#### Scenario: Locale-prefixed route renders in that locale
- **WHEN** a browser opens an implemented route under `/ca`
- **THEN** the page renders its user-facing copy in Catalan

#### Scenario: In-app navigation preserves the active locale
- **WHEN** the user follows an in-app link while the active locale is `/en`
- **THEN** the destination route is served under `/en`

#### Scenario: No interface string is fixed to one language
- **WHEN** the active locale changes among `es`, `en`, and `ca`
- **THEN** the page's user-facing copy changes with it and no string remains in a previous locale

### Requirement: Resolve the active language on load
When a signed-in caller has a stored language, the web client SHALL serve every route under that language and SHALL bring the URL to it, even when the request targets a different supported locale prefix or no prefix. For an anonymous caller, the client SHALL keep a supported URL prefix when present, otherwise the browser's preferred language when it is one of the supported locales, otherwise a default of `es`.

#### Scenario: Stored language overrides a different URL prefix
- **WHEN** a signed-in caller whose stored language is `en` opens `/es/settings`
- **THEN** the client serves the route under `/en` and renders its copy in English

#### Scenario: Stored language applies to a prefix-less request
- **WHEN** a signed-in caller whose stored language is `ca` opens `/settings`
- **THEN** the client serves the route under `/ca/settings`

#### Scenario: Anonymous caller keeps a supported prefix
- **WHEN** a caller without a stored language opens `/en/login`
- **THEN** the client serves the route under `/en` and does not change the locale

#### Scenario: Anonymous prefix-less request uses the browser language
- **WHEN** a caller without a stored language and with a browser that prefers `en` opens a prefix-less route
- **THEN** the client continues to the same route under `/en`

#### Scenario: Default locale is used with no signal
- **WHEN** a caller without a stored language and with a browser preference outside the supported locales opens a prefix-less route
- **THEN** the client continues to the same route under `/es`

#### Scenario: Unsupported prefix is rewritten
- **WHEN** an anonymous caller opens an implemented route under a prefix outside `es`, `en`, and `ca`
- **THEN** the client continues to the same route under a supported locale prefix

### Requirement: Present a language switcher on public pages only
The web client SHALL present a language switcher in the shared public header only when no session is active. The authenticated workspace shell SHALL NOT present a language switcher; a signed-in caller changes the language from the account settings page.

#### Scenario: Switcher is available to an anonymous visitor
- **WHEN** a public page renders without an active session
- **THEN** a language switcher offering `es`, `en`, and `ca` is available

#### Scenario: Switcher is hidden when signed in
- **WHEN** the session check reports an active session
- **THEN** the public header does not present the language switcher

#### Scenario: Workspace shell has no language switcher
- **WHEN** a workspace page renders
- **THEN** the shell does not present a language switcher

### Requirement: Persist a signed-in user's language choice
When a signed-in user selects a locale from the account settings page, the web client SHALL persist it by requesting `PATCH /users/me/settings` with the selected language and then serve the route under that locale. When no session is active, a selection on a public page SHALL change only the URL and SHALL NOT call the users service.

#### Scenario: Signed-in change is persisted
- **WHEN** a signed-in user selects `en` in the account settings
- **THEN** the client requests `PATCH /users/me/settings` with `en` and serves the route under `/en`

#### Scenario: Signed-out change makes no request
- **WHEN** a caller without an active session selects a locale on a public page
- **THEN** the route is served under the selected locale and no `PATCH /users/me/settings` request is sent

#### Scenario: Persistence failure stays recoverable
- **WHEN** `PATCH /users/me/settings` fails without a definitive answer after the user selects a locale
- **THEN** the current route is still served under the selected locale and the client does not revert the choice or block the switch

### Requirement: Apply the language on sign-in
On successful sign-in, the web client SHALL resolve the caller's stored language from `GET /users/me/settings` and serve the post-login destination under it. When the caller has no stored settings (`404`), the client SHALL create the default language `en` with `PATCH /users/me/settings` and serve the destination under `en`. When the read fails without a definitive answer the client SHALL keep the locale already in effect.

#### Scenario: Stored language is applied after sign-in
- **WHEN** sign-in succeeds for a caller whose stored language is `ca`
- **THEN** the client continues to the post-login destination under `/ca`

#### Scenario: Default language is created when none exists
- **WHEN** sign-in succeeds and `GET /users/me/settings` returns `404`
- **THEN** the client creates the default `en` with `PATCH /users/me/settings` and continues to the destination under `/en`

#### Scenario: Settings read failure does not block sign-in
- **WHEN** sign-in succeeds and the settings read fails without a definitive answer
- **THEN** the client completes the sign-in and continues under the locale already in effect

### Requirement: Keep the document language aligned
The web client SHALL declare the active locale as the document's language so that assistive technology and the browser reflect the rendered language.

#### Scenario: Document language follows the active locale
- **WHEN** the active locale changes
- **THEN** the document's declared language reflects the new active locale
