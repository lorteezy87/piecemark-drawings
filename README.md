# PieceMark — Steel drawings control

Domain-specific drawings management for **steel erection and fabrication subcontractors** (not generic PM).

## Run

```bash
npm run dev      # 0.0.0.0:8080
npm run build
npm run typecheck
```

## Production pilot

See **[PRODUCTION.md](./PRODUCTION.md)** for the go-live checklist, export/import, and multi-user roadmap.

**Use now:** create jobs, drawing sets/sheets, RFIs, holds, shop/field packages, upload PDFs (IndexedDB), IFC viewer, export JSON backups.

**Next:** shared Postgres + object storage for multi-crew cloud sync.

## Handoff (IFC / viewers)

See **[HANDOFF.md](./HANDOFF.md)** for embedding the IFC and sheet viewers in another app.
