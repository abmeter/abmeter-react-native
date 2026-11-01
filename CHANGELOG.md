# Changelog

## 0.2.0 (2026-11-01)

- Requires `abmeter` 0.4 or later (was 0.3). The 0.4 core pauses submits on a 429 for the response's `Retry-After` and keeps the batch queued instead of dropping it. The adapter itself is unchanged.
