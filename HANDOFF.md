# PieceMark — Agent Handoff

**Product name (working):** PieceMark  
**Domain:** Steel erection & fabrication drawings management for **subcontractors** (not generic PM)  
**Stack:** React 19 · TypeScript · Vite · TanStack Start/Router · Tailwind v4 · Zustand · Three.js · web-ifc  
**Demo job seed:** SE-24-1187 Phoenix Medical Center Steel (Southwest Fabricators)

This document is written so another agent can **port features into a different app** without rediscovering decisions, file maps, or gotchas.

---

## 1. What was built (product surface)

A full steel-subcontractor **drawings lifecycle** app:

| Area | Route | Purpose |
|------|-------|---------|
| Command Center | `/` | KPIs, activity, quick links for the active job |
| Drawing register | `/drawings`, `/drawings/$drawingId` | Sheets, revs, piece marks, markups, holds, linked RFIs/submittals |
| Drawing sets | `/drawings/sets/$setId` | Grouped sets |
| Sheet + IFC viewer | `/viewer?mode=sheet\|ifc` | 2D engineering sheet + real IFC 3D (split mode) |
| IDS validation | `/ids` | IFC vs buildingSMART IDS report tables |
| Piece marks | `/pieces` | Piece-mark index across drawings |
| Shop package | `/shop` | Fab queue / issued-for-fab view |
| Field package | `/field` | IFC field / issued-for-erection view |
| Erection sequences | `/sequences` | Sequence readiness gates |
| Transmittals | `/transmittals` | Issue packages (field/shop/GC/EOR) |
| Submittals | `/submittals` | Shop drawing packages |
| RFI log | `/rfis` | RFI create + answer & release holds |
| Holds board | `/holds` | Place/release holds on drawings |
| Jobs | `/projects` | Multi-job list + select |

**Domain language (use these terms, not “tasks/tickets”):** piece marks, shop vs erection sheets, AAN, issued for fab / erection, holds, RFIs, submittals, transmittals, sequences/areas, weld maps, anchor bolts, embeds.

---

## 2. Architecture (how it fits together)

```
┌─────────────────────────────────────────────────────────────┐
│  TanStack file routes (src/routes/*)                        │
│  AppShell sidebar (src/components/layout/app-shell.tsx)     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Zustand store + persist (src/lib/store.ts)                 │
│  Seed: src/data/seed.ts · Types: src/lib/types.ts           │
└───────────────────────────┬─────────────────────────────────┘
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   Drawing register   Sheet 2D canvas    IFC 3D (web-ifc)
   holds/RFI/xmit     drawing-geometry   ifc-loader + three
                            │                 │
                            └────────┬────────┘
                                     ▼
                            /viewer cross-highlight
                                     │
                            IDS: public/ids/* + /ids page
```

- **State:** client-only Zustand with `persist` (localStorage). No required backend for core demo.
- **SSR note:** IFC/Three must stay **client-only** (viewer mounts WebGL in `useEffect`).
- **Auth/db** under `src/lib/auth/*` and `db.ts` exist from the template; core drawings workflow is **store-driven**, not DB-driven.

---

## 3. Files to copy for a port (priority order)

### 3.1 Must-have domain core

| Path | Role |
|------|------|
| `src/lib/types.ts` | All domain types (Drawing, RFI, Hold, Transmittal, Sequence, statuses, labels) |
| `src/lib/store.ts` | Zustand store, actions, selectors, persist |
| `src/data/seed.ts` | Realistic PMC job seed data |
| `src/lib/utils.ts` | `cn()` helper |
| `src/components/status-badges.tsx` | Status chips for drawings/RFI/etc. |
| `src/components/layout/app-shell.tsx` | Nav + shell (adapt to target app chrome) |

### 3.2 Viewers (highest complexity)

| Path | Role |
|------|------|
| `src/lib/ifc-loader.ts` | web-ifc load, mesh build, orient Y-up, selection colors, IFC catalog |
| `src/components/viewer/ifc-model-viewer.tsx` | Three.js scene, OrbitControls, fullscreen, cut plane, upload IFC |
| `src/lib/drawing-geometry.ts` | Layout engine: grids, members, dims, BOM, styles by drawing type |
| `src/components/viewer/drawing-sheet-viewer.tsx` | Canvas painter: title block, grid bubbles, marks, BOM, hit-test |
| `src/hooks/use-fullscreen.ts` | Fullscreen API helper |
| `src/routes/viewer.tsx` | Sheet \| IFC \| Split orchestration + mark cross-link |

### 3.3 IDS / compliance

| Path | Role |
|------|------|
| `public/ids/steel-fab-erection.ids` | buildingSMART IDS (steel fab/erection requirements) |
| `public/ids/validation-results.json` | Precomputed report for UI |
| `scripts/validate-ids.py` | ifctester + ifcopenshell → JSON report |
| `scripts/fix-ifc-ids.py` | Patch IFC ObjectType / Material / LoadBearing psets |
| `src/routes/ids.tsx` | Report UI (tables: elements, failures, specs) |

### 3.4 Static assets (required for IFC)

| Path | Role |
|------|------|
| `public/wasm/web-ifc.wasm` | **Required** — web-ifc WASM (serve at `/wasm/`) |
| `public/wasm/web-ifc-node.wasm` | Optional for Node tooling |
| `public/models/pmc-steel.ifc` | Job steel model (IDS-compliant after fix script) |
| `public/models/sample-building.ifc` | Secondary sample |
| `public/models/example.ifc` | Alias/copy of sample |

### 3.5 Routes / packages (port selectively)

```
src/routes/index.tsx              Command center
src/routes/drawings*.tsx          Register + detail + sets
src/routes/rfis.tsx, holds.tsx, transmittals.tsx, submittals.tsx
src/routes/sequences.tsx, shop.tsx, field.tsx, pieces.tsx, projects.tsx
src/components/drawings/*         Table / set register UI
src/styles.css                    Design tokens (dark industrial)
```

### 3.6 npm deps to add in target app

```json
{
  "three": "^0.185.1",
  "@types/three": "^0.185.3",
  "web-ifc": "^0.0.77",
  "zustand": "^5.0.0",
  "lucide-react": "^0.510.0"
}
```

Python (IDS offline only, not runtime browser):

```bash
pip install ifcopenshell ifctester
python scripts/validate-ids.py --ifc path/to/model.ifc --ids path/to/spec.ids --out public/ids/validation-results.json
```

---

## 4. Domain model (condensed)

### Drawing statuses (workflow)

`draft` → `internal_review` → `submitted` → `aan` | `approved` | `revise_resubmit` → `issued_for_fab` → `issued_for_erection`  
Also: `on_hold`, `superseded`, `void`

### Drawing types

`erection`, `shop`, `anchor_bolt`, `embed`, `connection_detail`, `joist`, `deck`, `misc_metals`, `stair`, `weld_map`, `general_notes`, `mixed`

### Critical store actions (`src/lib/store.ts`)

- `placeHold` / `releaseHold`
- `addRfi` / `answerRfiAndReleaseHolds` (answers RFI **and** releases linked drawing holds)
- `createTransmittal` / `createSubmittal`
- Drawing rev / status updates + activity log append
- `selectedProjectId` multi-job filter

### Piece marks

- Live on `Drawing.pieceMarks: string[]`
- IFC elements use **Tag** as piece mark; loader maps Tag → drawing status colors
- Sheet viewer draws bubbles; click selects mark; IFC highlights same mark

---

## 5. Blender / Bonsai IFC import

- **Supported:** `.ifc` exported from Blender via **Bonsai** (BlenderBIM) as IFC2x3/IFC4.
- **Not supported:** `.blend`, glTF, FBX, OBJ.
- In the IFC viewer: **Load IFC / Blender**, drag-and-drop onto the canvas, **Info** panel for steps.
- Orientation tools: **Z-up fix** + yaw ±90° for Blender/classic IFC axis quirks.
- Piece marks: set element **Tag** in Blender for drawing register linking.

## 5b. IFC viewer — implementation notes (gotchas)

### Pipeline

1. `web-ifc` `IfcAPI.SetWasmPath("/wasm/", true)` then `Init()`
2. `OpenModel` → `LoadAllGeometry` → per-mesh verts/normals/indices + `flatTransformation`
3. `MeshStandardMaterial` colored by drawing status / hold / IFC type
4. `orientIfcGroup()`: **web-ifc already Y-up** for this pipeline — do **not** use naive `size.z > size.y` Z-up rotation (false-positive on square plans tips model on side)
5. Center XZ; sit base on y=0

### OrbitControls (tuned for this product)

| Setting | Value | Why |
|---------|-------|-----|
| `enableDamping` | `false` | No drift after mouse-up |
| `rotateSpeed` | `-0.7` | Horizontal drag direction feel |
| `_rotateUp` / `rotateUp` | negated | Invert pitch (up/down swapped) |
| `minDistance` | `0.15` | Allow close inspect |
| `maxDistance` | `Infinity` | Scroll never hits hard ceiling (“runs out of gas”) |
| `zoomSpeed` | `1.4` | Responsive wheel |
| `zoomToCursor` | `true` | Better 3D nav |
| Wheel fallback | capture + bubble | If OC clamps, manual dolly along view ray |
| Camera far | dynamic with distance | Distant zoom stays visible |
| Fog | 400–2500 | Don’t grey-out model when zooming out |

### Fullscreen

- `useFullscreen(rootRef)` on both sheet and IFC root containers
- Toolbar Maximize/Minimize + **double-click** canvas
- Esc exits; ResizeObserver reflows WebGL

### Catalog

```ts
// src/lib/ifc-loader.ts IFC_CATALOG
pmc-steel → /models/pmc-steel.ifc
sample    → /models/sample-building.ifc
// + user upload via object URL
```

---

## 6. Sheet viewer — implementation notes

- Pure **canvas 2D** (no PDF engine)
- `buildSheetLayout(drawing, pieceStatus, jobNumber)` produces grids, members, dims, callouts, BOM, notes, style (`plan|elevation|detail|anchor|notes`)
- Painter draws: paper, double border, grid bubbles, columns/beams/braces/anchors, dims, callouts, piece-mark bubbles, markup dots, title block (“SOUTHWEST FABRICATORS”), BOM table, north arrow, scale bar
- Hit-test on mark bubbles → `onSelectMark`
- Fit / zoom / pan / fullscreen

---

## 7. IDS validation workflow

**Spec file:** `public/ids/steel-fab-erection.ids`  
Requirements (columns, beams, members, footings):

- Tag (piece mark), Name, Description, ObjectType  
- Material association  
- `Pset_*Common.LoadBearing`  
- Columns: ASTM A992 material preference  

**Fix IFC for compliance:**

```bash
python scripts/fix-ifc-ids.py   # patches pmc-steel.ifc in place
python scripts/validate-ids.py   # writes validation-results.json
```

After fix: **25/25 specs pass** on `pmc-steel.ifc`.

**UI:** `/ids` loads `/ids/validation-results.json` — summary metrics + tables for failed specs / non-compliant elements / full failure rows.

Browser cannot run ifctester; re-validate offline and ship JSON, or add a server endpoint later.

---

## 8. Integration recipe (for another app)

### Minimal “viewers only” embed

1. Install `three`, `web-ifc`, copy `public/wasm/web-ifc.wasm` → served at `/wasm/web-ifc.wasm`
2. Copy `ifc-loader.ts`, `ifc-model-viewer.tsx`, `use-fullscreen.ts`
3. Copy models or point catalog URLs at your storage
4. Mount:

```tsx
<IfcModelViewer
  drawings={drawingsForJob}  // need pieceMarks + status for coloring
  projectName={job.name}
  selectedMark={mark}
  onSelectMember={(m) => setMark(m.mark)}
/>
```

5. Ensure client-only render (no SSR WebGL)

### Minimal “sheet only” embed

1. Copy `drawing-geometry.ts`, `drawing-sheet-viewer.tsx`, types for `Drawing`/`Markup`
2. Mount with a drawing that has `type`, `pieceMarks`, `sheetSize`, `title`, `number`, `currentRev`

### Full domain port

1. Copy types + store + seed  
2. Port routes or re-bind store to your existing routing  
3. Keep workflows: **hold ↔ RFI answer releases holds ↔ transmittal**  
4. Wire status colors through register, sheet, and IFC  

### Design system

- Dark industrial UI: dense tables, mono numbers for marks/revs  
- Tokens in `src/styles.css` (`--color-bg`, `--color-accent`, warn/success, etc.)  
- Prefer adapting to **your** design system; keep status semantics  

---

## 9. Known decisions & pitfalls

1. **Do not** reintroduce box-size Z-up rotation for web-ifc meshes (breaks square plans).  
2. **WASM path** must be `/wasm/` (or change `SetWasmPath` + static hosting). 404 WASM = blank IFC.  
3. OrbitControls **private** `_rotateUp` must be patched for mouse pitch invert (public `rotateUp` alone is insufficient).  
4. Nested `/drawings` needs layout route with `<Outlet />` + `drawings.index.tsx` (TanStack file routing).  
5. Store persist can go stale after schema changes — bump persist key if types change.  
6. IFC entities in seed model originally lacked `PredefinedType` in file; `ifcopenshell.api` attribute edit can throw — fix scripts set attributes by index / create psets manually.  
7. IDS Json reporter in ifctester may crash on PredefinedType; custom `validate-ids.py` avoids that path.  
8. Production build: avoid importing vendored tanstack vite preset; nitro only on `command === "build"` (see workspace `vite.config.ts` pattern).  

---

## 10. Seed job snapshot

- **Job:** SE-24-1187 Phoenix Medical Center Steel  
- **IFC:** multi-story frame — columns (C*), beams (B*/BY*), braces (BR-1..3), footings (AB-*)  
- After IDS fix: ObjectTypes like `W14X90`, `W21X44`, `HSS6X6X3/8`; materials ASTM A992; LoadBearing psets  

---

## 11. Commands (this workspace)

```bash
npm run dev          # 0.0.0.0:8080
npm run typecheck
npm run build
python scripts/fix-ifc-ids.py
python scripts/validate-ids.py
```

---

## 12. Suggested port checklist for the receiving agent

- [ ] Decide scope: full app vs viewers-only vs IDS-only  
- [ ] Copy types + map to existing job/drawing entities (or keep PieceMark schema)  
- [ ] Copy IFC loader + wasm static assets; verify `/wasm/web-ifc.wasm` 200  
- [ ] Mount IFC viewer client-only; verify upright model + unlimited scroll zoom  
- [ ] Mount sheet viewer; verify piece-mark click → highlight  
- [ ] Port hold/RFI/transmittal actions if workflow needed  
- [ ] Optionally wire IDS report page + re-run validation on customer IFCs  
- [ ] Restyle to target app chrome; keep steel terminology  
- [ ] Test mobile ~390px (tables scroll; viewers min-heights)  
- [ ] Production build + served assets (no MIME text/html on JS modules)  

---

## 13. One-line product pitch (for product/docs)

> PieceMark is a steel fab/erection drawings system: revisioned sheet register, holds/RFIs/transmittals, erection sequences, shop & field packages, live 2D shop/erection sheets, and real IFC 3D with piece-mark linking and IDS compliance — built for detailers, fab shops, and ironworkers, not generic project management.

---

*Generated for handoff from the Grok Build session that implemented PieceMark in this sandbox.*
