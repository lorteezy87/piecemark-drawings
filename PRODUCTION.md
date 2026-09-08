# PieceMark — Production readiness

## Ready for pilot use (Supabase backend)

| Capability | Status |
|------------|--------|
| Domain workflows | Ready |
| Create jobs / sheets / sequences | Ready |
| Export / import JSON package **v2** (org + role) | Ready |
| PDF sheet upload + IndexedDB restore | Ready |
| **Cloud persistence** (Supabase Postgres, per-row write-through) | Ready — Settings & cloud |
| **Sign-in** (Supabase Auth: email/password, magic link) | Ready |
| **Sheet files in Supabase Storage** (private bucket, 100 MB/file) | Ready |
| **Row Level Security** on every table + bucket | Ready (server-enforced) |
| Soft RBAC on mutations (station role) | Ready |
| IFC WASM same-origin `/wasm/` | Ready |
| Print field/shop/transmittal | Ready |
| CSV piece import + IFC tags | Ready |
| Schema | `supabase/migrations/0001_piecemark.sql` (applied to the project) |

## How to pilot (multi-device)

1. Sign in on each station with the **same account**  
2. Work — every change saves about a second later (Settings shows "saved hh:mm")  
3. On another station, **Settings → Refresh from cloud** pulls the latest  
4. First sign-in on a device with existing local jobs uploads them to the account  

## Data rules

- Every row belongs to the signed-in account (RLS; enforced by Postgres, not the UI).  
- Last write wins **per row**; there is no merge dialog.  
- **Upload this device's data** (Settings) merges local rows into the cloud by id.  
- Signed-out use is local-only; nothing leaves the browser.  

## Still later

- Company workspaces (share a job across accounts)  
- Real outbound email for RFIs  
- Real-time collab (Supabase Realtime on the same tables)  
- IFC models in Storage (today: browser only)  

## Deploy

```bash
npm run typecheck
npm run build
```

Set on the host (Vercel → Project → Environment Variables):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Remove the old `DATABASE_URL` / Grok auth variables — nothing reads them now.
In Supabase → Authentication → URL Configuration, add the deployed origin to
**Redirect URLs** so magic links and password resets land back in the app.

Live: https://piecemark-steel-drawings.vercel.app  
Repo: https://github.com/lorteezy87/piecemark-drawings  
