import * as WebIFC from "web-ifc";
import { unzipSync } from "fflate";
import * as THREE from "three";
import type { Drawing, DrawingStatus } from "@/lib/types";

export type IfcPickInfo = {
  expressID: number;
  mark: string;
  name: string;
  ifcType: string;
  drawingId?: string;
  status?: DrawingStatus;
  onHold?: boolean;
};

export type LoadedIfcModel = {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  byExpressId: Map<number, IfcPickInfo>;
  byMark: Map<string, number[]>;
  bounds: THREE.Box3;
  meshCount: number;
  dispose: () => void;
};

let apiPromise: Promise<WebIFC.IfcAPI> | null = null;

export function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new WebIFC.IfcAPI();
      // Same-origin WASM (public/wasm) — works offline and avoids CDN CSP blocks.
      api.SetWasmPath("/wasm/", true);
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

function statusColor(
  status: DrawingStatus | undefined,
  onHold: boolean,
  ifcType: string,
): THREE.Color {
  if (onHold || status === "on_hold") return new THREE.Color("#f59e0b");
  if (status === "revise_resubmit") return new THREE.Color("#f97316");
  if (status === "issued_for_erection") return new THREE.Color("#34d399");
  if (status === "issued_for_fab") return new THREE.Color("#60a5fa");
  if (status === "aan" || status === "approved") return new THREE.Color("#38bdf8");
  if (ifcType.includes("FOOTING") || ifcType.includes("Footing"))
    return new THREE.Color("#78716c");
  if (ifcType.includes("MEMBER") || ifcType.includes("Member"))
    return new THREE.Color("#a78bfa");
  if (ifcType.includes("COLUMN")) return new THREE.Color("#94a3b8");
  if (ifcType.includes("BEAM")) return new THREE.Color("#cbd5e1");
  return new THREE.Color("#9ca3af");
}

function typeName(api: WebIFC.IfcAPI, modelID: number, expressID: number): string {
  try {
    const line = api.GetLine(modelID, expressID, false) as { type?: number };
    const t = line.type;
    const map: Record<number, string> = {
      [WebIFC.IFCCOLUMN]: "IfcColumn",
      [WebIFC.IFCBEAM]: "IfcBeam",
      [WebIFC.IFCMEMBER]: "IfcMember",
      [WebIFC.IFCFOOTING]: "IfcFooting",
      [WebIFC.IFCSLAB]: "IfcSlab",
      [WebIFC.IFCWALL]: "IfcWall",
      [WebIFC.IFCWALLSTANDARDCASE]: "IfcWall",
      [WebIFC.IFCPLATE]: "IfcPlate",
      [WebIFC.IFCBUILDINGELEMENTPROXY]: "IfcBuildingElementProxy",
    };
    if (t && map[t]) return map[t];
  } catch {
    /* ignore */
  }
  return "IfcProduct";
}

function readTagAndName(
  api: WebIFC.IfcAPI,
  modelID: number,
  expressID: number,
): { tag: string; name: string } {
  try {
    const line = api.GetLine(modelID, expressID) as {
      Tag?: { value?: string };
      Name?: { value?: string };
    };
    const tag = line.Tag?.value?.trim() || "";
    const name = line.Name?.value?.trim() || tag || `Element ${expressID}`;
    return { tag: tag || name, name };
  } catch {
    return { tag: `E-${expressID}`, name: `Element ${expressID}` };
  }
}

function markMapFromDrawings(drawings: Drawing[]) {
  const map = new Map<
    string,
    { drawingId: string; status: DrawingStatus; onHold: boolean }
  >();
  for (const d of drawings) {
    for (const mark of d.pieceMarks) {
      if (!map.has(mark)) {
        map.set(mark, {
          drawingId: d.id,
          status: d.status,
          onHold: d.status === "on_hold",
        });
      }
    }
  }
  return map;
}

function matchDrawingMeta(
  tag: string,
  name: string,
  markMap: ReturnType<typeof markMapFromDrawings>,
) {
  if (markMap.has(tag)) return markMap.get(tag)!;
  const base = tag.split("-")[0] ?? tag;
  if (markMap.has(base)) return markMap.get(base)!;
  for (const [mark, meta] of markMap) {
    if (name.includes(mark) || tag.includes(mark)) return meta;
  }
  return undefined;
}

export type IfcOrientOptions = {
  /** Extra yaw in radians after auto upright (default: -90° so plan faces camera). */
  yaw?: number;
  /** Force classic IFC Z-up → Three Y-up (-90° about X). null = auto. */
  forceZUp?: boolean | null;
};

export type IfcOrientResult = {
  bounds: THREE.Box3;
  appliedZUp: boolean;
  yaw: number;
};

/**
 * Normalize IFC group to Three.js Y-up, preferred plan yaw, base on ground.
 *
 * web-ifc LoadAllGeometry is usually already Y-up. We only apply X=-90° when
 * the mesh is clearly still Z-up (height on Z, ground near Z=0, Y looks like a plan span).
 * Default yaw -90° matches steel plan facing the default camera approach.
 */
export function orientIfcGroup(
  group: THREE.Group,
  options: IfcOrientOptions = {},
): IfcOrientResult {
  const yaw = options.yaw ?? -Math.PI / 2;
  const forceZUp = options.forceZUp ?? null;

  group.rotation.set(0, 0, 0);
  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);

  let bounds = new THREE.Box3().setFromObject(group);
  const size0 = bounds.getSize(new THREE.Vector3());

  // Grounded-on-Y heuristic: base near y=0 and meaningful height on Y
  const groundedY =
    bounds.min.y > -2 &&
    bounds.min.y < Math.max(1, size0.y * 0.15) &&
    size0.y > 1;

  // True Z-up: Z is the tall/building axis OR ground is near z=0 with large Z
  const groundedZ =
    bounds.min.z > -2 &&
    bounds.min.z < Math.max(1, size0.z * 0.15) &&
    size0.z > size0.y * 1.2;

  let appliedZUp = false;
  const shouldZUp =
    forceZUp === true ||
    (forceZUp !== false && !groundedY && groundedZ);

  if (shouldZUp) {
    group.rotation.x = -Math.PI / 2;
    appliedZUp = true;
    group.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(group);
  }

  // Plan yaw (horizontal) — applied after upright so building stays vertical
  group.rotation.y = yaw;
  group.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(group);

  // Center plan on origin; sit base on y=0
  const center = bounds.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= bounds.min.y;
  group.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(group);

  return { bounds, appliedZUp, yaw };
}

/** Re-apply orientation + recentering after user tweaks yaw / Z-up. */
export function reorientIfcGroup(
  group: THREE.Group,
  options: IfcOrientOptions,
): THREE.Box3 {
  return orientIfcGroup(group, options).bounds;
}


/** Detect STEP IFC header in a binary buffer. */
export function looksLikeIfc(buf: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 64));
  return head.includes("ISO-10303-21") || head.includes("HEADER;");
}

/**
 * Resolve IFC bytes from a raw .ifc or .ifczip payload.
 * IFCZIP is a zip of one or more .ifc files (buildingSMART package).
 */
export function extractIfcBytes(
  buffer: Uint8Array,
  sourceName = "model.ifc",
): { bytes: Uint8Array; entryName: string } {
  const lower = sourceName.toLowerCase();
  const isZip =
    lower.endsWith(".ifczip") ||
    lower.endsWith(".zip") ||
    // ZIP local file header PK\x03\x04
    (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (!isZip) {
    if (!looksLikeIfc(buffer)) {
      throw new Error(
        "File does not look like an IFC STEP file (missing ISO-10303-21 header).",
      );
    }
    return { bytes: buffer, entryName: sourceName };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buffer);
  } catch {
    throw new Error("Could not read IFCZIP/ZIP archive.");
  }
  const names = Object.keys(files).filter((n) => !n.endsWith("/"));
  const ifcNames = names.filter((n) => n.toLowerCase().endsWith(".ifc"));
  if (ifcNames.length === 0) {
    throw new Error(
      "IFCZIP contained no .ifc entries. Re-export as .ifc or a zip with an IFC inside.",
    );
  }
  // Prefer largest .ifc (main model)
  let best = ifcNames[0]!;
  let bestSize = files[best]?.length ?? 0;
  for (const n of ifcNames) {
    const sz = files[n]?.length ?? 0;
    if (sz > bestSize) {
      best = n;
      bestSize = sz;
    }
  }
  const bytes = files[best];
  if (!bytes || !looksLikeIfc(bytes)) {
    throw new Error(`IFCZIP entry “${best}” is not a valid IFC STEP file.`);
  }
  return { bytes, entryName: best };
}

/** Load an IFC file from URL into a Three.js group with pick metadata. */
export async function loadIfcModel(
  url: string,
  drawings: Drawing[] = [],
): Promise<LoadedIfcModel> {
  const api = await getIfcApi();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch IFC: ${res.status} ${url}`);
  const raw = new Uint8Array(await res.arrayBuffer());
  const sourceName = url.split("/").pop()?.split("?")[0] || "model.ifc";
  const { bytes } = extractIfcBytes(raw, sourceName);
  const modelID = api.OpenModel(bytes);

  const markMap = markMapFromDrawings(drawings);
  const group = new THREE.Group();
  group.name = "ifc-model";
  const meshes: THREE.Mesh[] = [];
  const byExpressId = new Map<number, IfcPickInfo>();
  const byMark = new Map<string, number[]>();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const flatMeshes = api.LoadAllGeometry(modelID);
  for (let i = 0; i < flatMeshes.size(); i++) {
    const flat = flatMeshes.get(i);
    const expressID = flat.expressID;
    const { tag, name } = readTagAndName(api, modelID, expressID);
    const ifcType = typeName(api, modelID, expressID);
    const meta = matchDrawingMeta(tag, name, markMap);
    const info: IfcPickInfo = {
      expressID,
      mark: tag,
      name,
      ifcType,
      drawingId: meta?.drawingId,
      status: meta?.status,
      onHold: meta?.onHold,
    };
    byExpressId.set(expressID, info);
    const list = byMark.get(tag) ?? [];
    list.push(expressID);
    byMark.set(tag, list);

    const placedGeoms: THREE.BufferGeometry[] = [];
    for (let g = 0; g < flat.geometries.size(); g++) {
      const placed = flat.geometries.get(g);
      const geomData = api.GetGeometry(modelID, placed.geometryExpressID);
      const verts = api.GetVertexArray(
        geomData.GetVertexData(),
        geomData.GetVertexDataSize(),
      );
      const indices = api.GetIndexArray(
        geomData.GetIndexData(),
        geomData.GetIndexDataSize(),
      );
      const pos = new Float32Array((verts.length / 6) * 3);
      const nor = new Float32Array((verts.length / 6) * 3);
      for (let v = 0, p = 0; v < verts.length; v += 6, p += 3) {
        pos[p] = verts[v]!;
        pos[p + 1] = verts[v + 1]!;
        pos[p + 2] = verts[v + 2]!;
        nor[p] = verts[v + 3]!;
        nor[p + 1] = verts[v + 4]!;
        nor[p + 2] = verts[v + 5]!;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      geometry.setIndex(Array.from(indices));

      const mat4 = new THREE.Matrix4().fromArray(placed.flatTransformation);
      geometry.applyMatrix4(mat4);
      placedGeoms.push(geometry);
      geomData.delete?.();
    }

    if (placedGeoms.length === 0) continue;

    let geometry: THREE.BufferGeometry;
    if (placedGeoms.length === 1) {
      geometry = placedGeoms[0]!;
    } else {
      const merged = mergeGeometries(placedGeoms);
      placedGeoms.forEach((g) => g.dispose());
      geometry = merged;
    }
    geometries.push(geometry);

    const color = statusColor(info.status, !!info.onHold, ifcType);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.38,
      side: THREE.DoubleSide,
    });
    materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.expressID = expressID;
    mesh.userData.mark = tag;
    mesh.name = tag;
    group.add(mesh);
    meshes.push(mesh);
  }

  const { bounds } = orientIfcGroup(group);

  const dispose = () => {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    try {
      api.CloseModel(modelID);
    } catch {
      /* already closed */
    }
  };

  return {
    group,
    meshes,
    byExpressId,
    byMark,
    bounds,
    meshCount: meshes.length,
    dispose,
  };
}


export async function loadIfcModelFromBuffer(
  buffer: Uint8Array,
  drawings: Drawing[] = [],
  sourceName = "model.ifc",
): Promise<LoadedIfcModel> {
  const { bytes, entryName } = extractIfcBytes(buffer, sourceName);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/x-step" });
  const url = URL.createObjectURL(blob);
  try {
    // Temporarily name so extractIfcBytes on fetch path sees .ifc
    const loaded = await loadIfcModel(url, drawings);
    loaded.group.name = `ifc:${entryName}`;
    return loaded;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function mergeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let posCount = 0;
  let idxCount = 0;
  for (const g of geoms) {
    posCount += g.getAttribute("position").count;
    idxCount += g.getIndex()?.count ?? g.getAttribute("position").count;
  }
  const pos = new Float32Array(posCount * 3);
  const nor = new Float32Array(posCount * 3);
  const idx = new Uint32Array(idxCount);
  let pOff = 0;
  let iOff = 0;
  let vBase = 0;
  for (const g of geoms) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    const n = g.getAttribute("normal") as THREE.BufferAttribute | null;
    const index = g.getIndex();
    for (let i = 0; i < p.count; i++) {
      pos[pOff] = p.getX(i);
      pos[pOff + 1] = p.getY(i);
      pos[pOff + 2] = p.getZ(i);
      if (n) {
        nor[pOff] = n.getX(i);
        nor[pOff + 1] = n.getY(i);
        nor[pOff + 2] = n.getZ(i);
      }
      pOff += 3;
    }
    if (index) {
      for (let i = 0; i < index.count; i++) {
        idx[iOff++] = index.getX(i) + vBase;
      }
    } else {
      for (let i = 0; i < p.count; i++) idx[iOff++] = vBase + i;
    }
    vBase += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}

export function applyIfcSelection(
  meshes: THREE.Mesh[],
  byExpressId: Map<number, IfcPickInfo>,
  selectedMark: string | null,
) {
  for (const mesh of meshes) {
    const id = mesh.userData.expressID as number;
    const info = byExpressId.get(id);
    if (!info) continue;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const selected = !!selectedMark && info.mark === selectedMark;
    mat.color.copy(
      selected
        ? new THREE.Color("#2dd4bf")
        : statusColor(info.status, !!info.onHold, info.ifcType),
    );
    mat.emissive = new THREE.Color(selected ? "#115e59" : "#000000");
    mat.emissiveIntensity = selected ? 0.55 : 0;
  }
}

/** Sample models removed — pilot uses real uploaded IFC only. */
export const IFC_CATALOG: readonly {
  id: string;
  label: string;
  url: string;
  description: string;
}[] = [];
