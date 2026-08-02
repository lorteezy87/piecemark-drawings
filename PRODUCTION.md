# PieceMark — Production readiness

## Ready for pilot use (this stack — not Hatchable)

Stay on **PieceMark + Vercel/Postgres** for live jobs. Platform comparison (Hatchable) was evaluated and deferred; domain work stays here.

| Capability | Status |
|------------|--------|
| Domain workflows | Ready |
| Create jobs / sheets / sequences | Ready |
| Export / import JSON package **v2** (org + role) | Ready |
| PDF sheet upload + IndexedDB restore | Ready |
| **Cloud workspace push/pull** (PGLite or Postgres) | Ready — **Settings & Sync** |
| **Conflict-safe push** (reject stale; Force push option) | Ready |
| **Auto-push** (2.5s debounce + mutex) | Ready |
| **Auto-pull** when signed in and cloud is newer | Ready |
| **Server sheet files** (≤6MB) | Upload from Viewer/Register |
| **Bulk PDF match by sheet number** | Viewer + Drawing Sets |
| **Soft RBAC enforced on mutations** | Store + Settings |
| **Org name + default RFI email** | Settings (synced in package v2) |
| **Activity actors from signed-in user** | Ready |
| **Email RFI** (mailto) | RFI log |
| **Shop / field / transmittal print PDF** | Browser Print → PDF |
| **CSV piece import** | Settings + sample CSV |
| **IFC Tag → piece register** | Model load |
| **IFC WASM same-origin** `/wasm/` | Ready (no CDN CSP risk) |
| Sign-in (`/login` + `/api/auth/*`) | Wired |
| Domain migrations `0001`–`0003` | Applied on PGLite start / deploy migrate |
| Error / 404 | Ready |

## How to pilot today

1. **Sign in** (recommended) so cloud push/pull and activity names work  
2. **Jobs → New job** (or keep demo PMC job)  
3. **Drawing Sets → Add sheet** or **Settings → Upload CSV**  
4. **Viewer → upload PDFs**; open IFC to auto-index Tags  
5. Upload PDFs: single sheet or **Bulk match** (`S-101.pdf` style names)  
6. **Settings → Push to cloud** (or leave auto-push on)  
7. On a second device: **Sign in → wait for auto-pull** (or Pull)  
8. **Field Package → Print field set** for ironworkers  
9. **Transmittals → Print** for controlled issue  
10. Nightly **Jobs → Export** as extra backup  

### Sync rules (important)

- **Stale push is rejected** if another device already pushed a higher revision.  
- Use **Force push** only when you intentionally overwrite the cloud.  
- **Pull** warns if this station has local dirty changes.  
- Cloud package is **per authenticated user** (`user_id`).  
- Soft crew role is **UI-only**; server still scopes by account id.  

## Multi-user notes

- Last-write-wins only via **Force push**; normal path is pull-then-edit-then-push.  
- Large PDFs/IFCs stay in browser IndexedDB; optional server upload for files ≤ ~6MB.  
- `pm_project` mirror is pruned when jobs are removed from the package.  

## Still later (needs product / external services)

- Company/org multi-tenant membership (not single-user packages)  
- Object storage (S3/Blob) for large IFC/PDF  
- Real outbound email for RFIs (not mailto)  
- Server-enforced RBAC  
- Real-time multi-user collab  

## Deploy

```bash
npm run typecheck
npm run build   # vite + db:migrate
```

Env: `DATABASE_URL`, `BETTER_AUTH_*`, `GROK_AUTH_*` as injected by platform.

Live (bootstrap): `https://piecemark-steel-drawings.vercel.app` (re-deploy after this hardening).
