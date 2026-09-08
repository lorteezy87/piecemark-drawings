# PieceMark — Steel drawings control

Domain-specific drawings management for **steel erection and fabrication subcontractors** (not generic PM).

## Run

```bash
cp .env.example .env.local   # Supabase URL + publishable key (see below)
npm run dev                  # 0.0.0.0:8080
npm run build
npm run typecheck
```

## Backend: Supabase

Auth, data, and files all live in one Supabase project — no app server in the
data path. The browser talks to Supabase directly and Row Level Security scopes
every table to the signed-in user.

| Piece | Where |
| --- | --- |
| Sign-in | Supabase Auth (email + password, magic link) — `src/lib/auth/` |
| Jobs, sheets, RFIs, submittals, transmittals, sequences, revisions, markups, activity, PM tracker | One table each (`supabase/migrations/0001_piecemark.sql`); full record in `data`, key fields lifted for indexing |
| Uploaded sheet PDFs / images | Private Storage bucket `sheets` at `<user_id>/<drawing_id>/…`, cached in IndexedDB |
| Station role + company profile | `user_settings` |
| Title-block map | `title_block_maps` (one per job) |

Persistence is write-through (`src/lib/supabase/persist.ts`): on sign-in the
account's rows load into the store (an empty account is seeded from the device
on first sign-in); after that every change is diffed and saved about a second
later, row by row. Last write wins per row. Signed-out use is local-only.

Env (both safe for the browser; RLS does the protecting):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`VITE_AUTH_ENABLED=false` runs the app without sign-in (local demo mode).

## Production pilot

See **[PRODUCTION.md](./PRODUCTION.md)** for the go-live checklist, export/import, and multi-user roadmap.

**Use now:** create jobs, drawing sets/sheets, RFIs, holds, shop/field packages, upload PDFs (cloud Storage + IndexedDB cache), IFC viewer, export JSON backups.

## PM tracker

Multi-job project management layered over drawings control. Every page defaults
to the whole portfolio, not just the active job.

| Page | What it tracks |
| --- | --- |
| **Portfolio** | Every job on one screen — tasks, roadblocks, RFIs, holds, late fab, pending change value, next truck |
| **Task List** | The to-do list. Quick add, Today / This Week / Overdue / Waiting On views, grouping, checklists, recurrence, snooze, CSV export |
| **48h / 10-Day Look Ahead** | One window over tasks, RFI and submittal due dates, change orders, truck ship + required-on-site dates, fab milestones, erection starts, roadblock targets, and sequence dates |
| **Deliveries** | Load-level tracking by piece mark — ship date, required-on-site date, crane, receiving with short/damage capture |
| **Work Packages** | Fabrication times and due dates (release → fab → paint/galv → ship → on site) plus erection start/end, crew size, crane days, % erected |
| **Change Orders** | PCOs, COs, backcharges, T&M — with the originating RFI as the entitlement trail |
| **Roadblocks** | What is actually stopping the job, with owner, ball in court, target date, and schedule/cost impact |

**Tasks are auto-generated** from the records you already keep, so the list is
not a second place to type things:

- RFI opened → follow-up task (due date, or 7 days out)
- Sheet placed on hold → clear-hold task, 3 days out
- Submittal returned AAN / rejected / resubmit → revise task, 5 days out
- Load planned with a crane → confirm crane and laydown, day before required
- Load received short or damaged → replacement task on the fab shop
- Roadblock logged → chase task owned by whoever raised it

Auto tasks are keyed to their source record, so the same RFI or hold never
spawns a duplicate.

**Next:** shared company workspaces (today each account owns its own data).

## Handoff (IFC / viewers)

See **[HANDOFF.md](./HANDOFF.md)** for embedding the IFC and sheet viewers in another app.
