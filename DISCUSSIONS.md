# Discussions — Campus Connect

This document covers the discussion system: APIs, permissions, real-time features, pagination, nested replies, and moderation hooks.

## Quick summary
- Discussions are top-level threads with nested "thoughts" (top-level replies) and child replies.
- Permissions:
  - Create discussion: `senior`, `dept_admin`, `univ_admin` (see `canCreateDiscussion`).
  - Reply: `student`, `senior`, `dept_admin`, `univ_admin` (see `canReplyDiscussion`).
  - Edit/Delete: discussion author, `univ_admin`, or `dept_admin` of same department.
- Real-time: Socket.IO rooms are used (`discussion:<id>`, `dept:<id>`, `discussions:global`) implemented in `backend/config/socketio.js`.

## 1. High-level architecture
- API controllers: `backend/controller/discussionController.js` handles fetching lists, detail, create/edit/delete, add/edit/delete replies.
- Models: `backend/models/discussion.js` and `backend/models/discussionReply.js` hold discussion and reply state.
- Moderation: `backend/services/moderationService.js` and `backend/services/toxicityScanner.js` perform background scans and flagging.
- Notifications & emails: in `mailNotificationService` and `notificationService`.

## 2. API surface
- `GET /discussions` — list with cursor-based pagination and sorting (`latest`, `pinned`, `replies`). See `getDiscussions`.
- `GET /discussions/:id` — detail with paginated top-level thoughts and nested child replies — `getDiscussionDetail`.
- `POST /discussions` — create discussion (`createDiscussion`) — role-guarded.
- `PUT /discussions/:id` — edit discussion (`editDiscussion`) — permission checks via `canModerateDeletion`.
- `DELETE /discussions/:id` — soft delete (`deleteDiscussion`).
- `POST /discussions/:id/replies` — add a thought or reply (`addReply`).
- `PUT /discussions/:id/replies/:replyId` — edit reply (`editReply`).
- `DELETE /discussions/:id/replies/:replyId` — delete reply (`deleteReply`).

## 3. Pagination & shape
- Cursor-based pagination: endpoints accept `limit` and `cursor` where `cursor` is base64 of `createdAt` timestamp. Response returns `pagination.nextCursor` and `hasMore`.
- Nested replies: `getDiscussionDetail` fetches top-level thoughts and then fetches child replies, building a nested tree in-memory before returning.

## 4. Permissions & RBAC integration
- `canCreateDiscussion(userRole)` and `canReplyDiscussion(userRole)` implement role checks in `discussionController`.
- `canModerateDeletion(userId, discussion)` checks:
  - if actor is author → allow
  - if actor role is `univ_admin` → allow
  - if actor role `dept_admin` and author department matches actor department → allow
- These checks rely on `backend/models/user.js` role/department fields and `roleLevel` semantics.

## 5. Real-time behavior
- Backend Socket.IO emits events on create/update/delete of discussions and replies (see `req.io.to(...).emit(...)` calls in controller).
- Clients subscribe to rooms using `subscribe:discussion` and `unsubscribe:discussion` socket events (see `backend/config/socketio.js`).
- Events include `discussion:created`, `discussion:updated`, `discussion:deleted`, `thought:added/updated/deleted`, `reply:added/updated/deleted`.

## 6. Moderation integration
- On create/reply, `analyzeText()` is called; if `isToxic` is true, the reply is saved with `moderationStatus: 'flagged'` and `flaggedAt` set.
- Flagged items trigger `createNotification` for the author, `sendContentFlaggedEmail`, and an audit entry via `auditLogModel.create(...)`.
- Background moderation (`moderationService`) rescans recent content and flags items as needed.

## 7. Verification & tests
- Unit tests for permission helpers (`canModerateDeletion`, `canCreateDiscussion`, `canReplyDiscussion`).
- Integration tests to validate pagination cursors and nested reply shapes.
- E2E: open a socket connection, create a discussion from one client, verify subscribed client receives `discussion:created` event.

## 8. File references
- Controller: [backend/controller/discussionController.js](backend/controller/discussionController.js#L1-L800)
- Socket config: [backend/config/socketio.js](backend/config/socketio.js#L1-L200)
- Moderation: [backend/services/moderationService.js](backend/services/moderationService.js#L1-L400)
- Model: [backend/models/discussion.js](backend/models/discussion.js#L1-L200)
- Model: [backend/models/discussionReply.js](backend/models/discussionReply.js#L1-L200)

---

If you'd like, I can add a small Socket.IO test harness and automated tests for the discussion event flows.