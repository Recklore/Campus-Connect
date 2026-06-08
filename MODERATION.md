# Moderation — Campus Connect

This document describes automated and manual moderation flows: local toxic-bert scanning, background scans, flagging, notifications, and interplay with audit logs.

## Quick summary
- Automated toxicity scanning runs in two places:
  - Real-time: `discussionController.addReply` calls `analyzeText()` and may mark replies `flagged` immediately.
  - Batch: `moderationService.scanOnce()` runs daily and rescans recent content to flag items.
- Flagged content receives `moderationStatus: 'flagged'`, `isToxic: true`, `toxicityScore`, and `flagReason`.
- Flagging triggers an audit entry, an in-app notification to the author, and an email via `mailNotificationService`.

## 1. High-level architecture
- Scanners: `backend/services/toxicityScanner.js` provides `analyzeText()` that uses local `Xenova/toxic-bert` inference and returns `{ isToxic, score }`.
- Background task: `backend/services/moderationService.js` performs daily scans and flags content.
- Controllers: `discussionController`, `commentController` call `analyzeText()` on user submissions and handle flagged items immediately.
- Audit: flagged actions are recorded in `audit_logs` using `auditLogModel.create(...)`.

## 2. Flagging flow (real-time)
1. User submits a reply or comment.
2. Controller calls `analyzeText(body)`.
3. If `isToxic` true:
   - Save reply/comment with `moderationStatus: 'flagged'`, `isToxic: true`, `toxicityScore`, `flaggedAt`, `flagReason: 'automated_toxicity_scan'`.
   - Create a notification for the author (`createNotification` with `CONTENT_FLAGGED`).
   - Send `sendContentFlaggedEmail`.
   - Write an audit log entry for traceability.
4. If not toxic, save as `visible`.

## 3. Batch moderation
- `moderationService.scanOnce()`:
  - Looks back `MODERATION_SCAN_DAYS` (env) and scans recent `visible` items.
  - Flags items that return `isToxic` from scanner.
  - For each flagged item it notifies author, sends email, and creates audit log.

## 4. Admin review & remediation
- Admin UI (`adminController`) exposes endpoints to list flagged items, mark them `visible` again, or escalate to `rejected`/deleted.
- When an admin unflags or confirms content, controllers update discussion/reply counts accordingly (see `adminController` adjustments to `discussion` counters).

## 5. Auditing & forensic support
- Flagging actions include `actorId` (author), `actorRole`, `actionType: 'UPDATE'`, `targetType` and `meta` containing `moderation: 'flagged'` and `score`.
- Use audit logs to query content flagged by automated scans and correlate with manual admin actions.

## 6. Verification & tests
- Unit test `analyzeText()` wrapper behavior: ensure local toxic-bert output maps to `isToxic` correctly.
- Integration test `moderationService.scanOnce()` with seeded content to assert expected flagging and notifications.
- Manual: post content that is borderline toxic and assert that the frontend shows 'hidden for review' and that the author receives an email.

## 7. Operational & improvement notes
- False positives: provide an admin undo flow and a way for users to appeal flags (e.g., via objection mechanism or a "request review" endpoint).
- Queueing: if many items are flagged during a scan, consider batching notifications and emails to avoid bursts.
- Metrics: add counters for flagged items, false-positive reverts, and average toxicity scores to monitor scanner quality.

## 8. Code references
- Background moderation: [backend/services/moderationService.js](backend/services/moderationService.js#L1-L400)
- Real-time usage: [backend/controller/discussionController.js](backend/controller/discussionController.js#L1-L500)
- Scanner: [backend/services/toxicityScanner.js](backend/services/toxicityScanner.js#L1-L200)
- Mail & notifications: [backend/services/mailNotificationService.js](backend/services/mailNotificationService.js#L1-L400), [backend/services/notificationService.js](backend/services/notificationService.js#L1-L400)
- Audit model: [backend/models/auditLog.js](backend/models/auditLog.js#L1-L200)

---

If you'd like, I can implement an "appeals" endpoint that connects flagged posts/replies to the objection workflow.