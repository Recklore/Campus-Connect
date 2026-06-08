
 # Audit Logging — Campus Connect

 This document describes the project's audit-logging implementation in detail: what is logged, what is intentionally omitted, where logs are stored, role-specific behavior, known issues, verification steps, and recommended improvements.

 ## Quick summary
 - Audit records are stored in MongoDB in the `audit_logs` collection via Mongoose (`backend/models/auditLog.js`).
 - Two mechanisms create audit records:
   - Global middleware: `auditLogger` (`backend/middleware/auditLogger.js`) that heuristically logs authenticated requests.
   - Controller-level explicit writes: selected controllers (notably `adminController`) call `auditLogModel.create(...)` after successful admin actions.
 - Admin log viewing is restricted to `univ_admin` via `GET /admin/auditlogs` (`backend/routes/adminRouter.js`) and the UI `frontend/src/pages/AdminAuditLogs.jsx`.

 ## Schema (fields recorded)
 Schema implemented in `backend/models/auditLog.js`.

 - `actorId` (ObjectId, required): reference to the `users` collection. The user who performed the action.
 - `actorRole` (String, required): recorded role of the actor. Enum: `student`, `senior`, `dept_admin`, `univ_admin`, `guest`.
 - `actionType` (String, required): enum values: `CREATE`, `UPDATE`, `DELETE`, `ACCESS`. Mapped from HTTP verbs by the middleware.
 - `targetType` (String, required): logical type of the target (e.g., `Post`, `Comment`, `User`, `Department`, `Subscription`). Inferred heuristically from the request URL.
 - `targetId` (ObjectId, optional): id of the resource acted upon. Schema now permits `null` when inference fails.
- `requestId` (String, optional): correlation id (uses incoming `x-request-id` when present, otherwise generated server-side).
- `requestPath` (String, optional): original request URL path.
- `routeKey` (String, optional): normalized route pattern (dynamic ids replaced with placeholders for grouping/filtering).
- `requestMethod` (String, optional): HTTP method (`GET`, `POST`, etc.).
- `actionSummary` (String, optional): normalized action descriptor for quick scanning/filtering.
- `querySnapshot` (Object, optional): sanitized query values (whitelisted/trimmed, sensitive keys excluded).
- `paramsSnapshot` (Object, optional): sanitized route params (whitelisted/trimmed).
- `actorSnapshot` (Object, optional): point-in-time actor context (name/email/department/roleAtAction).
- `entitySnapshot` (Object, optional): safe, short preview of target content when useful (for example title/body preview).
- `responseSummary` (Object, optional): compact response context (status class/content length and whitelisted summary fields).
- `ipAddress` (String, optional): extracted from X-Forwarded-For header (first IP for campus wifi scenarios) or req.ip fallback via `getClientIp()` helper. Critical for forensic analysis.
- `statusCode` (Number, optional): HTTP response status code (2xx for success, 4xx/5xx for failure). Enables filtering by success/failure.
- `failureReason` (String, optional): categorized reason for failure (if statusCode >= 400). Enum: `auth_failure`, `validation_error`, `forbidden`, `not_found`, `rate_limit_exceeded`, `server_error`, `conflict`, `other`.
- `meta` (Object, optional): additional whitelisted metadata (e.g., `validationErrorCount`, `authErrorType`, `tokenErrorType`). Restricted to prevent secrets leaking into logs.
- `createdAt` / `updatedAt` (Date): added automatically by Mongoose `timestamps: true` and used for time queries. The explicit `timestamp` field was removed to avoid duplication.

Example successful audit log (JSON):

```
{
  _id: ObjectId("..."),
  actorId: ObjectId("..."),
  actorRole: "senior",
  actionType: "CREATE",
  targetType: "Post",
  targetId: ObjectId("..."),
  ipAddress: "203.0.113.1",
  statusCode: 201,
  createdAt: "2026-05-10T12:34:56.789Z"
}
```

Example failed audit log (JSON):

```
{
  _id: ObjectId("..."),
  actorId: ObjectId("..."),
  actorRole: "guest",
  actionType: "ACCESS",
  targetType: "Unknown",
  targetId: null,
  ipAddress: "203.0.113.1",
  statusCode: 401,
  failureReason: "auth_failure",
  meta: { authErrorType: "expired" },
  createdAt: "2026-05-10T12:35:00.123Z"
}
```

## Middleware behavior
- File: [backend/middleware/auditLogger.js](backend/middleware/auditLogger.js#L1-L240)
- The middleware is mounted globally in `backend/index.js` using `app.use(auditLogger)`.
- It only persists logs for authenticated requests (`req.user` must be present at response finish).
- It maps HTTP verbs to `actionType`:
  - `GET` => `ACCESS`
  - `POST` => `CREATE`
  - `PUT` / `PATCH` => `UPDATE`
  - `DELETE` => `DELETE`
- It heuristically infers `targetType` and `targetId` based on substring matches of `req.originalUrl` and common param names (`id`, `postId`, `commentId`, `userId`, `departmentId`, `subscriptionId`).
- For collection/list endpoints where no single entity id exists, `targetId` can remain `null` by design while request/action context is still captured via `routeKey`, `actionSummary`, and snapshots.
- IP extraction uses the `getClientIp()` helper from `backend/lib/ipExtraction.js`:
  - Splits X-Forwarded-For header and takes the first IP (original client)
  - Falls back to Express req.ip
  - Falls back to req.connection.remoteAddress
  - Returns null if none available
  - **Important for campus wifi**: all users share public IP; first IP from header identifies the actual client device
- To avoid noisy pre-handler logs and middleware-order timing issues, the middleware always attaches `res.on('finish')` and checks `req.user` inside that callback. This ensures auth middleware has had a chance to populate `req.user` before audit persistence is evaluated.
- The middleware defers creating the audit entry until `res.on('finish')` so the response status is known and controller-level writes (which run after successful DB changes) can set a flag to suppress duplicate middleware writes.
- Middleware captures:
  - Response `statusCode` to differentiate success (2xx/3xx) from failures (4xx/5xx)
  - Maps status codes to `failureReason` enum (400→validation_error, 401→auth_failure, 403→forbidden, 404→not_found, 429→rate_limit_exceeded, 5xx→server_error, etc.)
  - Optional `meta` field with whitelisted metadata (e.g., validation error count, token error type) for failures
   - Include `actorId`, `actorRole`, `targetType: 'User'`, `targetId`, and `ipAddress`.
 - After creating an explicit audit record, the controller sets `req.auditLogged = true` to prevent the middleware from duplicating the entry.

## Failed Request Logging (Forensic Analysis)
- **Comprehensive failure tracking**: middleware logs ALL authenticated requests, including failures (4xx/5xx), not just successful operations.
- **Failure categorization**: `failureReason` field categorizes failures:
  - `validation_error` (400): malformed requests, missing required fields, validation rule violations
  - `auth_failure` (401): missing/invalid/expired auth tokens, invalid credentials
  - `forbidden` (403): user lacks required role or permissions
  - `not_found` (404): requested resource does not exist or is not accessible (denies information leakage)
  - `rate_limit_exceeded` (429): request quota exceeded for endpoint/user/device
  - `server_error` (5xx): unhandled exceptions or third-party service failures
  - `conflict` (409): operation would create inconsistent state (e.g., demotion leaves no admin)
  - `other`: unmapped status codes
- **Example forensic queries**:
  - All failed login attempts from a user: `db.audit_logs.find({ actionType: 'ACCESS', failureReason: 'auth_failure', createdAt: { $gt: ISODate('...') } })`
  - Rate limit hits per IP (potential attack): `db.audit_logs.find({ failureReason: 'rate_limit_exceeded', ipAddress: '203.0.113.1' })`
  - All 500 errors in a time window: `db.audit_logs.find({ failureReason: 'server_error', createdAt: { $gte: ISODate('...'), $lte: ISODate('...') } })`
  - Validation errors by actor: `db.audit_logs.find({ failureReason: 'validation_error', actorId: ObjectId('...') })`
- **Optional metadata** for forensic context:
  - `meta.validationErrorCount`: number of validation errors on 400 responses
  - `meta.authErrorType`: specific auth failure type (e.g., "expired", "invalid_signature")
  - Future: request fingerprint, user agent, request size, retry count

## IP Extraction & Campus WiFi Scenario
- **Problem**: On campus wifi networks, all users share the same public IP address. Naive IP-based rate limiting or identification becomes useless.
- **Solution**: Use X-Forwarded-For header to extract the original client IP (first IP in the list) instead of the proxy/gateway IP.
- **Implementation**: New `backend/lib/ipExtraction.js` helper:
  - `getClientIp(req)` function extracts first IP from X-Forwarded-For header, with fallback to req.ip
  - Used by all rate limiters, audit logger, and authentication flows
  - Handles IPv4, IPv6, and loopback addresses via express-rate-limit's `ipKeyGenerator()`
- **Configuration**: Optional `TRUST_PROXY` env variable in `backend/index.js` (set to 1 for single reverse proxy layer)
- **Where it's used**:
  - `backend/middleware/auditLogger.js` — audit logs now contain correct client IP
  - `backend/middleware/rateLimiters.js` — IP-based rate limits (loginLimiter, signupLimiter, ipCeilingLimiter) use correct client IP
  - `backend/middleware/getClientKey.js` — device fingerprinting fallback uses correct IP

## Device Fingerprinting & Rate Limiting Integration
- **Fingerprinting mechanism** (`backend/middleware/getClientKey.js`):
  - Clients send x-device-fingerprint header (SHA256 hash, 64-char hex)
  - Frontend (`frontend/src/lib/clientKey.js`) generates fingerprint on first launch (browser storage)
  - Fingerprint is unique per device/browser combination, stable across sessions
  - Format validation: must match regex `^[a-f0-9]{64}$` (lowercase hex)
- **Priority**: fingerprint is preferred over IP for rate limiting (prevents false positives in shared networks)
  - If valid fingerprint present: rate limit key is `guest:fp:{fingerprint}`
  - If fingerprint invalid/missing: fallback to `guest:ip:{first_ip_from_xforwardedfor}`
- **Campus wifi integration**:
  - Scenario: 200 guest users on campus wifi, all sharing IP 203.0.113.0
  - Without fingerprinting: all 200 users hit shared rate limit after 150 requests (guestLimiter max)
  - With fingerprinting: each user has unique fingerprint → 150 requests per device (each user gets full quota)
  - This allows fair access for legitimate users while still protecting against abuse
- **Rate limiter strategy**:
  - `guestLimiter` (150 req/15min): uses fingerprint + IP fallback
  - `loginLimiter` (10 req/15min): keys by enrollment/email + IP fallback (fingerprint not applicable for login)
  - `signupLimiter` (10 req/15min): keys by enrollment/email + IP fallback
  - `ipCeilingLimiter` (30 req/hour): IP-only, but exempts university public IP (UNIVERSITY_PUBLIC_IP env var)
  - All limiters return RFC-6585 compliant `RateLimit-*` headers (Limit, Remaining, Reset)

 ## Access and role differences
 - Who gets logged: any authenticated user (all roles) — `actorRole` is recorded for every entry.
 - Who can view logs: API endpoint `GET /admin/auditlogs` is restricted to `univ_admin` via `requireRole('univ_admin')` and the frontend page checks for the same role.
 - There is no selective suppression by role: middleware does not exclude admin/privileged roles from being logged. The only suppression is for unauthenticated requests (they are not logged) and for requests explicitly marked `req.auditLogged`.

## Exporting audit logs
- `univ_admin` users can export the current audit log filter set as a JSON file.
- Backend route: `GET /admin/auditlogs/export`
  - Same filters as the list endpoint: `actorId`, `actionType`, `targetType`
  - Returns a downloadable JSON payload with:
    - `success`
    - `generatedAt`
    - `totalCount`
    - `filters`
    - `data` (full matching audit log array)
  - Response uses `Content-Disposition: attachment` so browsers download the file instead of rendering it inline.
- Frontend UI: the admin audit logs page includes an `Export JSON` action.
  - File: `frontend/src/pages/AdminAuditLogs.jsx`
  - It calls the export endpoint, receives a blob, and downloads it as `audit-logs-<timestamp>.json`.
- API helper: `frontend/src/lib/api.js` exposes `adminApi.exportAuditLogs(...)`.
- Exported JSON includes populated actor display fields (`name`, `role`) for easier analysis.

 ## What is intentionally NOT logged / exclusions
 - Request bodies and payloads are not recorded — middleware stores only `targetType` and `targetId` (not full request contents).
 - Passwords, password hashes, tokens, or other sensitive fields are not written to the audit logs by existing code. There is no generic redaction framework; controllers must avoid writing sensitive data into audit entries.
 - MAC addresses are intentionally omitted for privacy concerns (referenced in project plan but commented out in schema).

 ## Storage and indexes
 - Storage: MongoDB via Mongoose model `audit_logs` (`backend/models/auditLog.js`).
 - Indexes: `actorId` + `createdAt` and `targetType` + `targetId` + `createdAt` were created to support common query patterns.

 ## Configuration
 - Toggle middleware audit logging using the environment variable `AUDIT_LOGGING_ENABLED` (set to `false` to disable). Controller-level explicit writes currently do not honor this flag — you can add checks before `auditLogModel.create(...)` if you want a global switch.

 ## Known issues and design decisions
 - Duplicate logs: prior to the changes, middleware logged pre-handler and controllers wrote post-success logs, producing duplicates. Current behavior defers middleware writes until response finish and controllers set `req.auditLogged` to avoid duplicates.
 - `targetId` inference: middleware uses heuristics and may not correctly infer target IDs for all routes. When inference fails the schema accepts `null`. Consider improving inference or making handlers explicitly include `req.auditTarget = { type, id }` to give the middleware authoritative data.
 - Timestamps: removed explicit `timestamp` field; rely on `createdAt` to avoid ambiguity.
 - No global retention or export policy: consider adding automated TTL indexes or export hooks for compliance/archival.

 ## Verification steps (recommended tests)
 1. Unit test `auditLogger` mapping of HTTP verbs to `actionType` and `targetType` inference. Mock `req.user`, `req.method`, `req.originalUrl` and assert a document is created with expected fields.
 2. Integration test with `supertest` to assert middleware logs on response finish even when handler errors, and that controller explicit logs are written after successful operations.
 3. Access-control test for `GET /admin/auditlogs` requiring `univ_admin` role.
 4. Schema validation tests to ensure `actorId` & `actionType` are required and malformed writes are rejected.

 ## Recommended improvements
 - Centralize audit decisions: allow route handlers to call a small helper to record a structured audit event (e.g., `req.audit({ actionType, targetType, targetId, meta })`) and have middleware persist those structured events. This avoids fragile URL heuristics.
 - Redaction & schema: add an optional `meta` object field (with strict rules) and a redaction service to prevent future accidental logging of secrets.
 - Retention: add a TTL index or an archival/export pipeline for long-term storage and compliance.
 - Config: make controller-level writes honor `AUDIT_LOGGING_ENABLED` so a single env var toggles all logging.
 - Deduplication: if both middleware and controllers continue to log, consider deduplication by comparing near-time similar events (same actor, actionType, targetType, targetId within a short window).

 ## Code references
 - Model: [backend/models/auditLog.js](backend/models/auditLog.js#L1-L200)
 - Middleware: [backend/middleware/auditLogger.js](backend/middleware/auditLogger.js#L1-L240)
 - Admin controller (explicit writes): [backend/controller/adminController.js](backend/controller/adminController.js#L1-L400)
 - Audit logs API: [backend/routes/adminRouter.js](backend/routes/adminRouter.js#L1-L200)
 - Frontend viewer: [frontend/src/pages/AdminAuditLogs.jsx](frontend/src/pages/AdminAuditLogs.jsx#L1-L200)

 ---
 If you want, I can (A) add unit/integration tests now, (B) add a small `req.audit()` helper and migrate controller calls to it, or (C) open a PR with these docs and the code changes already applied. Which would you like next?
