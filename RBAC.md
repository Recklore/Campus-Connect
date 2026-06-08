# User Roles & Levels (RBAC) — Campus Connect

This document explains the role model, `roleLevel` semantics, how permissions are enforced, and admin behaviors such as department administration and promotion/demotion constraints.

## Quick summary
- Roles: `guest`, `student`, `senior`, `dept_admin`, `univ_admin`.
- `roleLevel` is derived from `role` and used for simple numeric comparisons; mapping defined in `backend/models/user.js`.
- Permissions are enforced both via middleware (e.g., `requireRole`) and inline controller checks (e.g., author vs admin checks in `postController` and `discussionController`).

## 1. Role model
- Defined in `backend/models/user.js` with `ROLE_LEVELS` mapping:
  - `guest: 0`, `student: 1`, `senior: 2`, `dept_admin: 3`, `univ_admin: 4`.
- `role` stored on user document; `roleLevel` computed on `pre('save')` and `pre('findOneAndUpdate')` hooks.
- Role-specific fields exist (e.g., `enrollmentNumber` for students, `employeeId` and `designation` for seniors).

## 2. Common permission enforcement patterns
- Middleware `verifyAccessToken` attaches `req.user` from JWT.
- `requireRole(...roles)` (pattern used in routes/controllers) checks `req.user.role` and returns 403 if missing privileges.
- Controller inline checks often do one-off checks like:
  - `isAuthor = String(resource.author) === String(req.user._id)`
  - `isAdmin = ['dept_admin','univ_admin'].includes(req.user.role)`
  - Department-scoped admin checks compare `user.department` with `target.department`.

## 3. Admin actions and constraints
- Department admin (`dept_admin`) is represented via `adminOf` array of Department ObjectIds on user record.
- Promotion/demotion actions live in `backend/controller/adminController.js` and must ensure invariants:
  - Avoid demoting last `univ_admin` or last admin of a department (conflict error).
  - Update `roleLevel` when `role` changes (handled by model hooks).

## 4. Enforcement examples (where to look)
- Post creation: `POST /posts` has an additional role guard for senior or above (`requireRole('senior', 'dept_admin', 'univ_admin')`).
- Post deletion: controllers check author OR admin membership before allowing soft delete (`postController.deletePost`).
- Discussion moderation: `canModerateDeletion` implements department-scoped deletion rights.

## 5. Auditing & RBAC
- Sensitive admin actions should be audited (see `backend/middleware/auditLogger.js` and explicit admin writes in `adminController`).
- Audit logs record `actorRole` + `actorId` to support reviews of role-based changes.

## 6. Verification & tests
- Unit tests for `ROLE_LEVELS` mapping (pre-save hooks), and for `requireRole` middleware.
- Integration tests for role-sensitive endpoints ensuring:
  - Students cannot access senior-only endpoints.
  - `dept_admin` can manage content within their department but not outside.
  - `univ_admin` has global privileges.

## 7. Recommendations / improvements
- Introduce a small `hasPermission(actor, action, resource)` helper to centralize permission checks and reduce duplicated logic across controllers.
- Consider feature flags for emergency admin actions (e.g., temporary elevated rights with audit timestamp and expiry).

## 8. Code references
- User model + roleLevel: [backend/models/user.js](backend/models/user.js#L1-L200)
- Example admin controller operations: [backend/controller/adminController.js](backend/controller/adminController.js#L1-L500)
- Example controller checks in posts/discussion: [backend/controller/postController.js](backend/controller/postController.js#L1-L400), [backend/controller/discussionController.js](backend/controller/discussionController.js#L1-L200)

---

If you want, I can start extracting repeated inline permission checks into a `permission` helper and update a small set of controllers to use it.