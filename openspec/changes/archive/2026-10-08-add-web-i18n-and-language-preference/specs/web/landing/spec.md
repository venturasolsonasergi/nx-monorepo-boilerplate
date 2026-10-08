# Spec Delta

## MODIFIED Requirements

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
