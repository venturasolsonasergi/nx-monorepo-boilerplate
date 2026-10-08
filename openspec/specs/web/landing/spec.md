# web/landing Specification

## Purpose
Present the nx-monorepo-boilerplate project to a first-time visitor: what it is,
the real technologies it uses, how its code is organized, and how its parts
communicate at runtime, with a clear way to start using it.

## Requirements

### Requirement: Serve a factual landing page at the root route
The locale-prefixed root route SHALL present the project name `nx-monorepo-boilerplate` prominently in the first viewport, followed by a brief factual explanation of the project's purpose. A request to `/` without a locale prefix SHALL continue to the landing page under a chosen locale prefix. Landing copy SHALL be presented in the active locale. The landing content SHALL describe the project as it actually is and SHALL NOT present invented claims, statistics, testimonials, or marketing content.

#### Scenario: A visitor opens the landing page
- **WHEN** a browser opens the landing page under a supported locale prefix
- **THEN** the page renders the project name prominently and a brief factual explanation of the project's purpose in that locale

#### Scenario: Prefix-less root continues to a locale
- **WHEN** a browser opens `/` without a locale prefix
- **THEN** it is continued to the landing page under a chosen locale prefix

#### Scenario: Content stays factual
- **WHEN** a visitor reads the landing page
- **THEN** every technology, directory, and structural element named on the page corresponds to the project's real stack and layout, and no invented metric, claim, or customer is shown

### Requirement: Present the real architecture
The landing page SHALL present an architecture overview that names `apps/web`,
`apps/api`, the `auth`, `users`, and `orders` services, and the
`infrastructure -> application -> domain` layer direction. The overview SHALL
distinguish code organization from runtime communication and SHALL NOT present
the services as independently deployed systems when `apps/api` hosts them. The
overview SHALL be rendered as accessible, structured content that remains
understandable on both mobile and desktop widths.

#### Scenario: Architecture is explained
- **WHEN** a visitor reaches the architecture section
- **THEN** the overview shows `apps/web`, `apps/api`, the `auth`, `users`, and `orders` services, and the `infrastructure -> application -> domain` layer direction

#### Scenario: Code layout and runtime are distinguished
- **WHEN** the architecture overview is shown
- **THEN** it presents the services as modules hosted by `apps/api` rather than as independently deployed systems

#### Scenario: Architecture survives a narrow viewport
- **WHEN** the landing page is viewed on a narrow viewport
- **THEN** the architecture overview remains readable without horizontal scrolling and its content is available to assistive technology

### Requirement: Offer entry actions from the landing page
The landing page SHALL offer a link to `/login` and a link to `/signup` so a
visitor can access the application or create an account.

#### Scenario: Visitor chooses to sign in
- **WHEN** a visitor activates the sign-in action on the landing page
- **THEN** the browser navigates to `/login`

#### Scenario: Visitor chooses to create an account
- **WHEN** a visitor activates the sign-up action on the landing page
- **THEN** the browser navigates to `/signup`

### Requirement: Apply a minimal, consistent visual identity
The landing page SHALL use a typographic wordmark for the project name and a
brand accent that is distinct from and compatible with the existing design
tokens. The visual treatment SHALL remain consistent with the shared component
system and SHALL NOT introduce decorative illustrations or a full brand system.

#### Scenario: Visual identity is present
- **WHEN** the landing page renders
- **THEN** the project name appears as a typographic wordmark and a brand accent distinguishable from the base tokens is applied consistently

#### Scenario: No decorative extras
- **WHEN** the landing page renders
- **THEN** no decorative illustration, mascot, or unrelated imagery is shown
