# PieceMark — Production readiness

## Ready for pilot use (this stack — not Hatchable)

| Capability | Status |
|------------|--------|
| Domain workflows | Ready |
| Create jobs / sheets / sequences | Ready |
| Export / import JSON package **v2** (org + role) | Ready |
| PDF sheet upload + IndexedDB restore | Ready |
| **Cloud workspace push/pull** | Ready — Settings & Sync |
| **Conflict-safe push** + **multi-device conflict dialog** | Ready |
| **Use cloud / Merge / Force keep mine** | Dialog when stations diverge |
| **Auto-push** (2.5s debounce + mutex) | Ready |
| **Auto-pull** + dirty/remote conflict UI | Ready |
| **Chunked cloud files** (~28MB max, multi-part) | Ready |
| Soft RBAC on mutations | Ready |
| IFC WASM same-origin `/wasm/` | Ready |
| Print field/shop/transmittal | Ready |
| CSV piece import + IFC tags | Ready |
| Migrations `0001`–`0004` | PGLite start / deploy migrate |

## How to pilot (multi-device)

1. Sign in on both stations with the **same account**  
2. Work and let auto-push run (or Settings → Push)  
3. If another station already pushed, the **conflict dialog** appears:  
   - **Use cloud** — replace this station  
   - **Merge both** — overlay by entity id, then push  
   - **Keep mine** — force push over cloud  
4. Large sheets (≤ ~28MB) upload in parts; bigger files stay local  

## Sync rules

- Stale push is **rejected** (dialog opens automatically).  
- Force push only from the dialog or Settings.  
- Cloud package is **per authenticated user**.  
- Soft crew role is UI-only; server scopes by account id.  

## Still later (external services)

- Company multi-tenant orgs  
- S3/Blob for very large IFCs (100MB+)  
- Real outbound email for RFIs  
- Server-enforced RBAC  
- Real-time collab  

## Deploy

```bash
npm run typecheck
npm run build
```

Live: https://piecemark-steel-drawings.vercel.app  
Repo: https://github.com/lorteezy87/piecemark-drawings  
