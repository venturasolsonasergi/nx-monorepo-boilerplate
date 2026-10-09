# web/theming Specification

## Purpose

Apply the user's color theme preference across the web client: resolve the initial theme before first paint from a locally cached preference, keep the signed-in caller's stored settings authoritative, and let anonymous visitors pick light or dark from the header.

## Requirements

### Requirement: Initial theme resolves before interaction
The web client SHALL apply an effective theme to the whole interface based on a locally cached preference that survives reloads: the cached value when it is `light` or `dark`, and the operating system color scheme when the cache is absent, unreadable, or `system`.

#### Scenario: Cached dark theme renders dark
- **WHEN** a visitor loads any page with `dark` cached as the theme preference
- **THEN** the interface renders dark from the first paint, without a light flash

#### Scenario: No cached preference follows the system
- **WHEN** a visitor loads the site for the first time with no cached theme preference
- **THEN** the interface follows the operating system color scheme

#### Scenario: Unreadable cached value falls back to system
- **WHEN** the cached theme preference holds a value other than `light`, `dark`, or `system`
- **THEN** the interface follows the operating system color scheme

### Requirement: Signed-in caller's stored theme is authoritative
For a signed-in caller, once the settings response (`GET /users/me/settings` contract) is available, the web client SHALL apply the stored `theme` as the effective theme and SHALL update the cached preference to match it, replacing any differing cached value.

#### Scenario: Stored theme overrides the cached value
- **WHEN** a signed-in caller loads the site with `light` cached while their settings store `dark`
- **THEN** the interface switches to dark once the settings response arrives and the cached preference is updated to `dark`

#### Scenario: Settings unavailable keeps the cached theme
- **WHEN** the settings request for a signed-in caller fails without a result
- **THEN** the interface keeps the cached theme in effect for the session

### Requirement: Signed-in theme selection from settings
On `/settings`, a signed-in caller SHALL be able to choose between `light`, `dark`, and `system`; the client SHALL apply the choice to the interface immediately and send it to the caller's settings through `PATCH /users/me/settings`, updating the cached preference.

#### Scenario: Selecting a theme takes effect and persists
- **WHEN** a signed-in caller on `/settings` selects `dark`
- **THEN** the interface turns dark immediately, the choice is sent to `PATCH /users/me/settings`, and the cached preference becomes `dark`

#### Scenario: Persistence failure keeps the session choice
- **WHEN** the persistence request for a theme selection fails
- **THEN** the selection remains in effect for the current session, and the stored settings value applies again on the next signed-in load

#### Scenario: System selection resumes OS tracking
- **WHEN** a signed-in caller on `/settings` selects `system`
- **THEN** the interface follows the operating system color scheme, including later OS changes while the session stays open

### Requirement: Anonymous header toggle
For visitors who are not signed in, the public header SHALL offer a theme control beside the language switcher offering exactly `light` and `dark`; choosing one applies it immediately and caches it locally, and the control SHALL offer no way to return to `system`. Signed-in callers SHALL NOT be offered this header control, as `/settings` is their theme surface.

#### Scenario: Anonymous visitor toggles dark
- **WHEN** an anonymous visitor activates the header theme control and chooses dark
- **THEN** the interface turns dark immediately and remains dark on the next reload

#### Scenario: Toggle before any choice reflects the system
- **WHEN** an anonymous visitor who has made no theme choice observes the header control
- **THEN** the interface follows the operating system color scheme until they choose light or dark

#### Scenario: Signed-in caller has no header theme control
- **WHEN** a signed-in caller views the public header
- **THEN** the header offers no theme control

### Requirement: System preference tracking
While the effective preference is `system` — a signed-in caller whose stored theme is `system`, or an anonymous visitor with no cached choice — the web client SHALL follow the operating system color scheme, including changes that occur while the page is open.

#### Scenario: OS scheme change while on system
- **WHEN** the operating system color scheme changes while the effective preference is `system`
- **THEN** the interface switches to the new scheme without a reload

### Requirement: Cached theme survives sign-out
The web client SHALL keep the cached theme in effect across sign-out.

#### Scenario: Theme persists after sign-out
- **WHEN** a signed-in caller with an effective dark theme signs out
- **THEN** the interface remains dark under the anonymous session
