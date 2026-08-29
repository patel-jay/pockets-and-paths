# Security notes

This document describes the MVP’s trust boundaries; it is not a claim of production certification.

## Implemented

- Browser-isolated viewer IDs use cryptographically generated UUIDs.
- Session and demo-authentication cookies are HTTP-only, same-site, path-scoped, and secure on HTTPS.
- Demo login, logout, and reset mutations reject cross-origin browser requests.
- SQL uses prepared statements rather than interpolated user input.
- Every database operation is scoped to the current viewer.
- Category ownership is checked before an expense is inserted.
- Money, dates, supported currencies, text length, and budget type are validated server-side.
- GraphQL introspection UI is disabled. Expected domain errors keep safe messages and error codes; unexpected resolver details are masked.
- Integration tests verify browser-viewer isolation and cross-viewer category rejection against the real local Worker and D1 database.
- The CI workflow checks formatting, linting, types, unit and integration tests, the browser smoke flow, and a production build.

## Before handling real financial data

- Replace the published dummy credentials with managed authentication, account recovery, session rotation, and revocation.
- Add CSRF tokens if requests can become cross-site and rate limiting at the edge.
- Add a strict Content Security Policy and other deployment headers.
- Encrypt and back up production data according to a documented retention policy.
- Add audit events for changes, deletion/export workflows, monitoring, and dependency scanning.
- Conduct threat modeling and independent security review.
