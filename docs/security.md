# Security notes

This document describes the MVP’s trust boundaries; it is not a claim of production certification.

## Implemented

- Browser-isolated viewer IDs use cryptographically generated UUIDs.
- Session and demo-authentication cookies are HTTP-only, same-site, path-scoped, and secure on HTTPS.
- Personal passwords use salted PBKDF2-HMAC-SHA-256 at 600,000 iterations plus a server-held pepper; plaintext passwords are never stored.
- Personal sessions use 256-bit random tokens, store only token digests in D1, expire after 30 days, and are revoked on logout.
- Registration is invite-only and requires server-side Cloudflare Turnstile verification. Sign-in and registration attempts are throttled with hashed client identifiers.
- Personal accounts and demo sandboxes share the same viewer-scoped data boundary, while demo reset is explicitly denied to personal sessions.
- Demo login, logout, and reset mutations reject cross-origin browser requests.
- SQL uses prepared statements rather than interpolated user input.
- Every database operation is scoped to the current viewer.
- Category ownership is checked before an expense is inserted.
- Expense currency is derived from its parent budget, and a database trigger rejects inconsistent writes.
- Money, dates, supported currencies, text length, and budget type are validated server-side.
- GraphQL introspection UI is disabled. Expected domain errors keep safe messages and error codes; unexpected resolver details are masked.
- Integration tests verify invite-only registration, account session restoration, demo-reset isolation, browser-viewer isolation, and cross-viewer category rejection against the real local Worker and D1 database.
- The CI workflow checks formatting, linting, types, unit and integration tests, the browser smoke flow, and a production build.

## Current limitations and next hardening steps

- Add verified-email delivery, password recovery, multi-factor authentication, session management, and account deletion/export.
- Prefer managed identity before opening self-service registration to the public; the current registration flow is intentionally invite-only.
- Add edge-native rate limiting and CSRF tokens if cookies or requests become cross-site.
- Add a strict Content Security Policy and other deployment headers.
- Encrypt and back up production data according to a documented retention policy.
- Add audit events for changes, deletion/export workflows, monitoring, and dependency scanning.
- Conduct threat modeling and independent security review.
