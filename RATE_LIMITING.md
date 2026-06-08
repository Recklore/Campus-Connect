# Rate Limiting — Campus Connect

This document explains the rate limiting strategy, key generation, Redis backing, IP/fingerprint handling (campus wifi), and how limiters are applied across auth and public flows.

## Quick summary
- Rate limiting uses `express-rate-limit` with a Redis store (`backend/middleware/rateLimiters.js`).
- Key generation prefers `x-device-fingerprint` (client-side stable fingerprint) and falls back to IP extracted via `getClientIp()`.
- Important limiters:
  - `authLimiter`: 200 req / 15 min (per user id / ip fallback).
  - `loginLimiter`: 10 req / 15 min (per enrollment/email / ip fallback).
  - `signupLimiter`: 10 req / 15 min (per enrollment/email / ip fallback).
  - `guestLimiter`: 150 req / 15 min (prefers fingerprint).
  - `ipCeilingLimiter`: 30 req / hour (IP-only ceiling, skip for `UNIVERSITY_PUBLIC_IP`).

## 1. High-level architecture
- Middleware file: `backend/middleware/rateLimiters.js` defines and exports limiter instances.
- Redis store: `backend/config/redis.js` exposes `makeStore()` used by rate limiters to persist counters.
- Client fingerprinting: `backend/middleware/getClientKey.js` builds keys like `guest:fp:<fp>` or `guest:ip:<ipKey>`.
- IP extraction: `backend/lib/ipExtraction.js` reads `X-Forwarded-For` first then falls back to `req.ip`.

## 2. Key generation rules
- For guest traffic: if `x-device-fingerprint` header matches `/^[a-f0-9]{64}$/` => use fingerprint key `guest:fp:<fp>`.
- For signup/login: use role-specific identity when provided:
  - `student` => `enrollmentNumber` uppercased -> `login:enrollment:<ENROLL>`
  - `senior` => `emailId` lowercased -> `login:email:<EMAIL>`
  - Fallback: `login:ip:<ipKey>` or `signup:ip:<ipKey>`.
- IP key normalization uses `rateLimit.ipKeyGenerator(getClientIp(req))`.

## 3. Limiters in use
- `authLimiter` — protects authenticated API surface (`auth:*` keys).
- `loginLimiter` — prevents brute force on login endpoints.
- `signupLimiter` — protects signup flow and prevents mass registrations.
- `guestLimiter` — throttles unauthenticated usage (prefers fingerprint to avoid campus-wide collisions).
- `ipCeilingLimiter` — global IP-based cap with support to exempt `UNIVERSITY_PUBLIC_IP`.

## 4. Headers & responses
- Limiters set `standardHeaders: true` to expose `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` when supported.
- Error responses follow `{ success: false, message: '...' }` JSON shape.

## 5. Campus WiFi & fingerprinting
- Problem: many clients share one public IP when behind campus WiFi.
- Solution used:
  - Prefer `x-device-fingerprint` header for guest keying (generated and stored in frontend localStorage).
  - Fallback to first IP from `X-Forwarded-For` if fingerprint missing.
  - `ipCeilingLimiter` remains IP-only but can `skip` when IP equals `UNIVERSITY_PUBLIC_IP` env var.

## 6. Operational concerns
- Redis availability: rate limiters use Redis; if Redis is unavailable, `express-rate-limit` store behavior should be tested. Consider graceful degradation to in-memory store (short TTL) with an alert.
- Key collisions: ensure fingerprint generation client-side produces good entropy (different browsers/devices yield different hash).
- Header spoofing: `x-device-fingerprint` can be spoofed; combine with browser fingerprinting heuristics and rate limits per-IP ceilings.

## 7. Verification & tests
- Unit tests: keyGenerator functions (mock `req` with headers and body) to assert keys returned.
- Integration tests: run `supertest` against endpoints with fake Redis store to verify TTLs and `RateLimit-*` headers.
- Manual: simulate campus wifi by forcing same IP across many clients and ensuring fingerprint fallback allows per-device quotas.

## 8. File references
- Rate limiters: [backend/middleware/rateLimiters.js](backend/middleware/rateLimiters.js#L1-L200)
- Fingerprint helper: [backend/middleware/getClientKey.js](backend/middleware/getClientKey.js#L1-L120)
- IP helper: [backend/lib/ipExtraction.js](backend/lib/ipExtraction.js#L1-L120)
- Redis store helper: [backend/config/redis.js](backend/config/redis.js#L1-L200)

---

If you want, I can add integration tests for `loginLimiter` and `guestLimiter` next.