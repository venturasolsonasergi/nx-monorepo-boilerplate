# Design

## Context

See proposal.md for motivation. The `/verified` route reports the result of an emailed verification link; the web client has no sign-in or verification-request route.

## Goals / Non-Goals

**Goals:**
- Make the verification and unauthenticated profile messages match the routes the browser actually provides.
- Preserve the missing sign-in and verification-request journey as an explicit release dependency.

**Non-Goals:**
- Implementing login, verification-request, or session-establishment UI.
- Changing backend behavior or HTTP contracts.

## Decisions

- Update only browser-visible copy and remove the `/verified` recovery link from the unauthenticated profile state. This makes current navigation honest without pulling the missing auth journey into scope.
- Keep the dependency in this change's design and the modified web requirements; do not create a separate capability for a flow that is not implemented.
- Update the existing Playwright assertions to protect the corrected copy and link behavior.

## Risks / Trade-offs

- **A new user still cannot sign in or request verification from the browser.** Keep that journey recorded as a release dependency; this change avoids presenting the result page as a working recovery action.