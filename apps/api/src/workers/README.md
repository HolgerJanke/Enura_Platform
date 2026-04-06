# Connector Workers

This directory will contain BullMQ worker classes for each connector in Phase 4.

## Planned Workers
- `reonic.worker.ts` — Reonic CRM sync (leads, offers, team members)
- `threecx.worker.ts` — 3CX Cloud sync (call logs)
- `bexio.worker.ts` — Bexio sync (invoices, payments)
- `google-calendar.worker.ts` — Google Calendar sync (appointments)
- `leadnotes.worker.ts` — Leadnotes sync (lead ingestion)

## Architecture
Each worker implements the `ConnectorBase` interface and runs as an independent BullMQ job.
See CLAUDE.md Section 5.5 for the background job pattern.
