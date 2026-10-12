# Spec Delta

## Purpose

Define the browser-observable serving behavior of the built web client in production: it is served from its own HTTPS origin, direct navigation to any client route renders the app, and the served client targets the deployed API origin.

## ADDED Requirements

### Requirement: Serve the built client from its own origin

The production deployment SHALL serve the built web client over HTTPS from its own browser origin, separate from the API origin. A browser navigating to that origin SHALL receive the built client (its HTML shell and assets), not a development server or an error.

#### Scenario: Origin serves the built client

- **WHEN** a browser navigates to the web client's production origin
- **THEN** it receives the built client's HTML shell, and the assets the shell references load successfully from the same origin

### Requirement: Direct navigation resolves client routes

Serving the built client SHALL resolve direct navigation to any client route — deep links, page refreshes, and back/forward navigations — by returning the client so its router can render the target view, instead of returning a server error. Asset paths SHALL still be served as their actual files, never replaced by the client shell.

#### Scenario: Deep link renders the app

- **WHEN** a browser navigates directly to a client route (for example a signed-in settings path) or refreshes while on one
- **THEN** the server returns the client shell and the client renders the route's view rather than a not-found error

#### Scenario: Static assets are served as files

- **WHEN** a browser requests a built asset path (a hashed script, stylesheet, or font)
- **THEN** the server returns that asset with its file content, and does not substitute the client shell

### Requirement: Served client targets the deployed API origin

The served client SHALL send its API requests to the deployed API origin. The API's existing public contracts govern those requests; the API SHALL accept requests from the web client's production origin as a trusted origin, so authenticated flows work end to end from the production client origin.

#### Scenario: Authenticated flow works from the production origin

- **WHEN** a user performs an authenticated flow (for example sign-in) from the production client origin, per the API's public auth contracts
- **THEN** the request reaches the API origin, the API treats the client origin as trusted, and the flow completes with the session established
