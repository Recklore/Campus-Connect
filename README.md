# Campus Connect

Campus Connect is a university communication and engagement platform built with a MERN-style stack. It combines official post publishing, department-centric feeds, threaded discussions, moderation, audit logging, notifications, and role-based administration in a single system.

## What the project does

- Centralizes campus announcements and department updates.
- Supports role-aware access for `guest`, `student`, `senior`, `dept_admin`, and `univ_admin`.
- Enforces a post review workflow with objections before content becomes official.
- Provides threaded discussions with nested replies and realtime updates.
- Adds automated moderation, auditability, and abuse controls suitable for a shared campus network.

## Core capabilities

### Authentication and session management

- Signup and login support separate student and senior identity flows.
- Signup verification and password reset use Redis-backed one-time tokens delivered by email.
- Auth state is cookie-based:
  - `campus_connect_token` - access token, 15 minutes
  - `campus_connect_refresh` - refresh token, 7 days
- Guest login exists for low-friction entry into the platform.

### Role-based access control

- Role model: `guest`, `student`, `senior`, `dept_admin`, `univ_admin`
- `roleLevel` is derived from role for simple hierarchical checks.
- Sensitive actions are protected through route middleware and controller-level permission checks.

### Posts, objections, and approval lifecycle

- Senior users and admins can create posts.
- New posts start as `under_review`.
- Eligible users can raise objections during the review window.
- Posts move to `official` only after the review window expires with no unresolved objections.
- A background cron job performs automatic approval for eligible posts.

### Discussions and realtime updates

- Public discussion listing and detail endpoints are available.
- Authenticated users can participate according to role rules.
- Socket.IO powers live updates for discussion rooms and department rooms.
- Nested replies are supported through top-level thoughts and child replies.

### Moderation

- Content is checked in real time during submission and again in a scheduled background scan.
- The moderation pipeline uses a local toxicity model (`Xenova/toxic-bert` via `@huggingface/transformers`).
- Flagged content generates notifications, emails, and audit records.

### Audit logging and forensic support

- Authenticated actions are recorded in MongoDB audit logs.
- Logs include actor, role, target, request path, status code, failure reason, IP context, and timestamps.
- `univ_admin` users can inspect and export filtered audit logs as JSON.

### Abuse protection

- Redis-backed rate limiters protect auth flows and general usage.
- Guest traffic prefers a device fingerprint header over raw IP.
- This reduces false throttling on shared campus WiFi while preserving abuse controls.

### File handling

- Post attachments support `JPEG`, `PNG`, `WebP`, and `PDF`.
- Each attachment is limited to 10 MB.
- A post can include up to 5 attachments.
- SHA-256 checksums are computed for uploaded files.
- Cloudinary is used for asset storage when attachment upload is enabled.

## Architecture

### Frontend

- React 19
- Vite
- React Router
- Socket.IO client

### Backend

- Node.js
- Express 5
- MongoDB with Mongoose
- Redis
- Socket.IO
- Nodemailer
- Cloudinary

### Background services

- Post auto-approval cron job
- Daily moderation scan job
- Redis-backed verification, reset, and rate-limit coordination

## Repository structure

```text
.
+-- backend/                     # Express API, models, middleware, jobs, seed scripts
+-- frontend/                    # React + Vite client
+-- AUTH_FLOW.md                 # Auth and session flow deep dive
+-- POST_CREATION_APPROVAL.md    # Post review and objection workflow
+-- DISCUSSIONS.md               # Discussion system and realtime behavior
+-- MODERATION.md                # Automated moderation flow
+-- AUDIT_LOGGING.md             # Audit model and export behavior
+-- RATE_LIMITING.md             # Rate limiting and campus WiFi strategy
+-- RBAC.md                      # Role model and authorization rules
```

## Major component documentation

These root documents are the best deep-dive references for individual subsystems:

- `AUTH_FLOW.md`
- `POST_CREATION_APPROVAL.md`
- `DISCUSSIONS.md`
- `MODERATION.md`
- `AUDIT_LOGGING.md`
- `RATE_LIMITING.md`
- `RBAC.md`

## Local development setup

### Prerequisites

- Node.js and npm
- MongoDB
- Redis
- SMTP credentials for outgoing email
- Cloudinary credentials if you want attachment uploads to work

### 1. Install dependencies

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

### 2. Configure environment variables

Backend environment keys used by the codebase:

```env
BACKEND_PORT=
FRONTEND_BASE_URL=
MONGO_CONN_URL=
JWT_SECRET_KEY=
NODE_ENV=
TRUST_PROXY=
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_HOST=
REDIS_PORT=
MAIL_ID=
MAIL_PASS=
UNIVERSITY_PUBLIC_IP=
SEED_USER_PASSWORD=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AUDIT_LOGGING_ENABLED=
MODERATION_THRESHOLD=
MODERATION_SCAN_DAYS=
MODERATION_BATCH_SIZE=
```

Frontend environment keys:

```env
VITE_API_BASE_URL=
```

### 3. Start the backend

```bash
cd backend
npm start
```

Note:

- The current backend `start` script uses `nodemon index.js`.
- `nodemon` is not declared in `backend/package.json`, so it must already exist in your environment or be installed separately.
- If you prefer, you can run the server directly with `node index.js`.

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

### 5. Health check

Once the backend is running, verify:

```bash
curl http://localhost:<BACKEND_PORT>/health
```

Expected response:

```json
{ "success": true, "message": "ok" }
```

## Seed and maintenance scripts

From `backend/`:

- `npm run seed:Departments` - seed department data from `backend/department_data.json`
- `npm run seed:Users` - seed users from `backend/university_data.json`
- `npm run seed:Posts` - seed post data from `backend/post_data.json`
- `npm run auto-approve-posts` - run the post approval task once
- `npm run moderation-scan` - run the moderation scan once
- `npm run test:rate-limit` - exercise rate-limit behavior

Recommended bootstrap order:

1. Seed departments
2. Seed users
3. Seed posts

Important:

- The current signup flow expects eligible users to already exist in the database, typically from `backend/university_data.json`.
- In practice, seeded user records start inactive and become active after email verification.
- If a user is not present in the seeded dataset, signup follows the "not in records" path.

## Runtime behavior worth knowing

- CORS is configured for `FRONTEND_BASE_URL` with credentials enabled.
- Redis is required for verification tokens, resend cooldowns, password reset, and rate limiting.
- Audit logging is enabled by default unless `AUDIT_LOGGING_ENABLED=false`.
- The auto-approval job is scheduled hourly.
- The moderation scan job is scheduled daily at `01:00` server time.
- Post uploads with attachments fail if Cloudinary is not configured.

## Primary route groups

- `/auth` - signup, verify, login, logout, refresh, forgot-password
- `/departments` - department listing, detail, subscriptions
- `/posts` - feed, post detail, likes, comments, objections
- `/discussions` - threads, replies, realtime-backed discussion flow
- `/notifications` - notification listing and read state
- `/users` - current user, profile view, search
- `/admin` - stats, audit logs, objections, moderation flags, role changes

## Current implementation status

Based on the current codebase:

- Core auth, posts, discussions, moderation, audit logging, and rate limiting are implemented.
- Administrative oversight features are present, including audit export and moderation actions.
- Explicit profile privacy controls are still not implemented.
- Formal production-grade performance and availability evidence is still pending.
- "Official reply" behavior exists, but report-level parity for stronger faculty-tag semantics is still noted as partial.

## Suggested reading order

If you need to understand the system quickly:

1. `AUTH_FLOW.md`
2. `RBAC.md`
3. `POST_CREATION_APPROVAL.md`
4. `DISCUSSIONS.md`
5. `MODERATION.md`
6. `AUDIT_LOGGING.md`
7. `RATE_LIMITING.md`
