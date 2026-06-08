# Post Creation & Approval (Objection Mechanism) — Campus Connect

This document describes the post lifecycle, the objection mechanism, auto-approval behavior, and operational details needed to review, test, and maintain post creation and approval flows.

## Quick summary
- Creation, objection, and viewing of posts under review are restricted to senior+ roles (`senior`, `dept_admin`, `univ_admin`).
- Posts are created under `status: under_review` and move to `official` automatically after review window unless objected.
- Objections can be raised by eligible users while a post is `under_review`; objections move the status to `objected` and block auto-approval.
- A background cron (`postApprovalService`) runs periodically to auto-approve posts whose `reviewExpiresAt` has passed and have no unresolved objections.
- Key files: `backend/models/post.js`, `backend/controller/postController.js`, `backend/services/postApprovalService.js`, `backend/services/mailNotificationService.js`, `backend/services/notificationService.js`.

## 1. High-level architecture
- API: `backend/controller/postController.js` exposes endpoints for create, edit, delete, raiseObjection, resolveObjection, fetch, and moderation helpers.
- Persistence: `posts` collection implemented by `backend/models/post.js` with `status`, `reviewExpiresAt`, and `objections[]` fields.
- Background job: `postApprovalService.startAutoApprovalTask()` schedules a cron task that calls `executeAutoApproval()` to flip qualifying posts to `official` and trigger notifications/emails.
- Notifications: Email and in-app notifications use `mailNotificationService` and `notificationService`.

## 2. API surface (server)
-- `POST /posts` — create a new post (protected, role-restricted to `senior`, `dept_admin`, `univ_admin`). See `postController.createPost`.
- `GET /posts/:id` — read a post (public/protected checks apply).
- `PUT /posts/:id` — edit a post (author or admin).
- `DELETE /posts/:id` — soft-delete a post (author or admin). See `postController.deletePost`.
-- `POST /posts/:id/objection` — raise an objection (role-restricted to `senior`, `dept_admin`, `univ_admin`). See `postController.raiseObjection`.
- `POST /posts/:id/objection/resolve` — resolve objections (admins or post review handlers). See `postController.resolveObjection`.

## 3. Post schema notes
See `backend/models/post.js`.
- `status`: enum `['under_review','official','objected','rejected']`. Default: `under_review`.
- `reviewExpiresAt`: Date — when the post becomes eligible for auto-approval.
- `objections[]`: each objection contains `raisedBy`, `reason`, `isResolved`, `raisedAt`.
- Indexes: `{ department, status, isDeleted, createdAt }`, and `{ status, reviewExpiresAt }` to support efficient approval queries.

## 4. Creation flow
1. User calls `POST /posts` with title/body/attachments/department.
2. Server validates input (`backend/middleware/postValidation.js`) and user role (e.g., `requireRole` for some endpoints).
3. New post is saved with:
   - `status = 'under_review'`
   - `reviewExpiresAt = now + REVIEW_WINDOW` (frontend/backed policy; default set in controller or env)
4. A verification email/notification is not needed for standard posts; system may notify department admins.

## 5. Objection mechanism (raise + resolve)
- Raising an objection (`raiseObjection`):
  - Only authenticated users may raise objections.
  - Request must include `reason` (min length enforced in `postController`).
  - Controller logic:
    - Loads post by id; ensures post exists and `status === 'under_review'`.
    - Appends objection entry to `post.objections`, sets `post.status = 'objected'`, saves.
    - Sends author notification via `sendObjectionRaisedEmail` and in-app notification via `notifyObjectionRaised`.
    - Returns `200` with the updated post object.
- Resolving an objection (`resolveObjection`):
  - Typically performed by admins or automated handlers.
  - If all objections become `isResolved === true` and `reviewExpiresAt` has not passed → status reverts to `under_review`.
  - If all objections resolved and `reviewExpiresAt` passed (i.e., expired), auto-transition to `official` occurs; controller sends `sendObjectionResolvedEmail` and `notifyObjectionResolved`.

## 6. Auto-approval background task
- Implemented in `backend/services/postApprovalService.js`:
  - Query selects posts with `status: 'under_review'`, `reviewExpiresAt <= now`, and no unresolved objections.
  - `updateMany()` sets `status: 'official'` and `isOfficial: true`.
  - For each approved post, the service sends emails and notifications.
- Scheduling: runs every minute by default (`cron.schedule('*/1 * * * *', ...)`).

## 7. Emails and notifications
- `sendPostApprovedEmail`, `sendObjectionRaisedEmail`, `sendObjectionResolvedEmail` are in `backend/services/mailNotificationService.js`.
- In-app notifications use `backend/services/notificationService.js`.
- When an admin deletes a post (soft delete), `sendPostDeletedByAdminEmail` is used.

## 8. Edge cases and decisions
- Duplicate objections: schema allows multiple objections from different users; controllers do not currently block duplicate reasons or same-user duplicate objections — consider deduplication logic.
- Race conditions during auto-approval: `executeAutoApproval()` uses a query + updateMany; controllers should ensure `post.status` checks and save semantics to avoid conflicting transitions.
- Sensitive content: posts are scanned by moderation services; flagged posts may be set to `flagged` or `rejected` by moderators.

## 9. Verification steps (tests / manual checks)
- Unit: test `raiseObjection` and `resolveObjection` in `postController` with mock DB to assert `status` transitions and notifications called.
- Integration: seed DB with `under_review` posts with/without objections and run `postApprovalService.executeAutoApproval()` to confirm posts move to `official` and emails/notifications are produced.
- Manual: create a post in frontend, raise objection from another account, resolve objection as admin, and observe emails and status changes in DB.

## 10. Code references
- Model: [backend/models/post.js](backend/models/post.js#L1-L200)
- Controller: [backend/controller/postController.js](backend/controller/postController.js#L1-L1200)
- Auto-approval service: [backend/services/postApprovalService.js](backend/services/postApprovalService.js#L1-L200)
- Mail notifications: [backend/services/mailNotificationService.js](backend/services/mailNotificationService.js#L1-L400)
- Notifications: [backend/services/notificationService.js](backend/services/notificationService.js#L1-L400)

---

If you want, I can add unit tests for `postApprovalService.executeAutoApproval()` next.