# Spec Delta

## MODIFIED Requirements

### Requirement: Provide the authenticated application shell

The authenticated workspace routes (`/dashboard` and `/settings`) SHALL render
inside a shared application shell containing a sidebar that is collapsible on
desktop, an accessible off-canvas side menu on mobile, a compact header, and a
main work area. The shell's sidebar SHALL offer navigation to the dashboard as
its only navigation entry, and the shell SHALL provide access to the account
settings at `/settings` and a way back to the landing at `/` through its account
control and its brand logo rather than as sidebar navigation entries. The shell
SHALL show only implemented
destinations and account actions and SHALL NOT present placeholder links,
invented metrics, demo navigation, or business screens added to fill space. The
shell SHALL be operable by keyboard, SHALL close the mobile side menu when the
user presses Escape, and SHALL return focus to the control that opened it.

#### Scenario: Desktop sidebar is collapsible
- **WHEN** the dashboard is viewed on a desktop viewport
- **THEN** the sidebar can be collapsed and expanded and the dashboard remains reachable

#### Scenario: Mobile side menu is accessible
- **WHEN** the dashboard is viewed on a narrow viewport
- **THEN** the side menu is opened from a control, its destination is reachable, Escape closes it, and focus returns to the control that opened it

#### Scenario: The shell is shared by the authenticated routes
- **WHEN** the browser opens `/dashboard` or `/settings`
- **THEN** the same application shell renders (sidebar, compact header, and account control) and the public header does not render

#### Scenario: Sidebar offers only the dashboard
- **WHEN** the authenticated workspace shell renders
- **THEN** the sidebar presents the dashboard as its only navigation entry and presents no navigation entry for the account settings or the landing

#### Scenario: Navigation between implemented destinations
- **WHEN** the user activates the dashboard entry in the sidebar, the account settings action in the shell's account control, or the brand logo in the shell
- **THEN** the browser navigates to `/dashboard`, `/settings`, or `/` respectively, within the active locale

#### Scenario: Language switcher is not in the shell
- **WHEN** the workspace shell renders
- **THEN** no language switcher is presented in the shell

#### Scenario: No placeholder or invented content
- **WHEN** the dashboard shell is rendered
- **THEN** it shows no disabled or dead navigation entries, no invented metrics, and no demo or business content beyond the implemented destinations
