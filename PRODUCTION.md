# PieceMark — Production readiness

## Ready for pilot use (autonomous work completed)

| Capability | Status |
|------------|--------|
| Domain workflows | Ready |
| Create jobs / sheets / sequences | Ready |
| Export / import JSON package | Ready |
| PDF sheet upload + IndexedDB restore | Ready |
| **Cloud workspace push/pull** (PGLite or Postgres) | Ready — **Settings & Sync** |
| **Auto-push** (2.5s debounce) | Ready — toggle on Settings |
| **Server sheet files** (≤6MB) | Upload from Viewer/Register |
| **Bulk PDF match by sheet number** | Viewer + Drawing Sets |
| **Soft RBAC** (admin/detailer/fab/field/pm/gc) | Settings → crew role |
| **Org name + default RFI email** | Settings |
| **Email RFI** (mailto) | RFI log |
| **Shop package print PDF** | Shop Package → Print |
| **Server file store** (`pm_file`, base64 ≤ ~6MB) | Ready API |
| **CSV piece import** | Ready — Settings + sample `public/samples/piece-marks-import.csv` |
| **IFC Tag → piece register** | Ready on model load |
| **Print field package / transmittal PDF** | Ready (browser Print → PDF) |
| Sign-in (`/login` + `/api/auth/*`) | Wired |
| Domain migration `0002_domain.sql` | Applied on PGLite start / deploy migrate |
| Error / 404 | Ready |

## How to pilot today

1. **Jobs → New job** (or keep demo)  
2. **Drawing Sets → Add sheet** or **Settings → Upload CSV**  
3. **Viewer → upload PDFs**; open IFC to auto-index Tags  
4. Upload PDFs: single sheet or **Bulk match** (`S-101.pdf` style names)  
5. **Settings → Push to cloud** (or leave auto-push on)  
5. **Field Package → Print field set** for ironworkers  
6. **Transmittals → Print** for controlled issue  
7. Nightly **Jobs → Export** as extra backup  

## Multi-user notes

- Cloud package is **per authenticated user** (`user_id`).  
- Last-write-wins on push (revision counter).  
- Sign in on each device, then **Pull** / **Push**.  
- Large PDFs stay in browser IDB; optional server upload via `saveDrawingFile` for smaller files.

## Still later (needs product decisions / external services)

- Company/org multi-tenant (not single user)  
- Object storage (S3/Blob) for large IFC/PDF  
- Email for RFIs  
- Full RBAC  
- Real-time collab  

## Deploy

```bash
npm run typecheck
npm run build   # vite + db:migrate
```

Env: `DATABASE_URL`, `BETTER_AUTH_*`, `GROK_AUTH_*` as injected by platform.
