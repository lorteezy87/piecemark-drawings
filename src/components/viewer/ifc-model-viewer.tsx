import { Link } from "@tanstack/react-router";
import {
  Box,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useFullscreen } from "@/hooks/use-fullscreen";
import {
  IFC_CATALOG,
  applyIfcSelection,
  loadIfcModel,
  reorientIfcGroup,
  type IfcPickInfo,
  type LoadedIfcModel,
} from "@/lib/ifc-loader";
import { idbGetFile, idbPutFile, ifcUploadKey } from "@/lib/idb-files";
import type { Drawing } from "@/lib/types";
import { cn } from "@/lib/utils";

export type IfcMember = IfcPickInfo;

type Props = {
  drawings: Drawing[];
  projectName: string;
  selectedMark?: string | null;
  onSelectMember?: (member: IfcPickInfo) => void;
  onMarksDiscovered?: (marks: string[]) => void;
  className?: string;
};

type OrbitControlsInternal = OrbitControls & {
  _rotateUp?: (angle: number) => void;
  _scale?: number;
};

/**
 * Real IFC viewer — loads STEP Physical File IFC via web-ifc WASM,
 * streams tessellated meshes into Three.js, pick by piece-mark Tag.
 */
export function IfcModelViewer({
  drawings,
  projectName,
  selectedMark,
  onSelectMember,
  onMarksDiscovered,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const [modelId, setModelId] = useState<string>("none");
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meshCount, setMeshCount] = useState(0);
  const [picked, setPicked] = useState<IfcPickInfo | null>(null);
  const [sectionY, setSectionY] = useState(1);
  const [yawDeg, setYawDeg] = useState(-90);
  const [forceZUp, setForceZUp] = useState<boolean | null>(null);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;

  // Restore last uploaded IFC from IndexedDB (survives refresh)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (customUrl) return;
      const blob = await idbGetFile(ifcUploadKey());
      if (!blob || cancelled) return;
      let name = "uploaded.ifc";
      try {
        name = sessionStorage.getItem("piecemark-ifc-upload-name") || name;
      } catch {
        /* ignore */
      }
      const url = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setCustomUrl(url);
      setModelId("custom");
      setLoading(true);
      setUploadedName(name);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showBlenderHelp, setShowBlenderHelp] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sceneApi = useRef<{
    setSelected: (mark: string | null) => void;
    setClip: (t: number) => void;
    resetCamera: () => void;
    reorient: (yawDeg: number, forceZUp: boolean | null) => void;
    loaded: LoadedIfcModel | null;
  } | null>(null);

  const activeUrl =
    customUrl ??
    IFC_CATALOG.find((m) => m.id === modelId)?.url ??
    null;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // No sample models — wait for user upload / IDB restore
    if (!activeUrl) {
      setLoading(false);
      setError(null);
      setMeshCount(0);
      mount.replaceChildren();
      const empty = document.createElement("div");
      empty.className =
        "flex h-full min-h-[420px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[var(--color-muted)]";
      empty.innerHTML =
        "<div style=\"font-weight:600;color:var(--color-fg)\">No IFC loaded</div><div>Upload a job .ifc / .ifczip (Tekla, SDS/2, Revit, or Blender Bonsai export).</div>";
      mount.appendChild(empty);
      return () => {
        mount.replaceChildren();
      };
    }

    let disposed = false;
    let loaded: LoadedIfcModel | null = null;
    let raf = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControlsInternal | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0e12");
    // Wide fog so zooming out never "disappears into nothing"
    scene.fog = new THREE.Fog("#0c0e12", 400, 2500);

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.05,
      20000,
    );
    camera.position.set(40, 30, 45);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    // Keep wheel on the canvas from scrolling the page
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    controls = new OrbitControls(
      camera,
      renderer.domElement,
    ) as OrbitControlsInternal;
    // Complete stop on release — no inertia / coasting
    controls.enableDamping = false;
    controls.dampingFactor = 0;
    controls.rotateSpeed = 0.7; // natural: drag right → look/orbit right
    controls.panSpeed = 0.85;
    // Unlimited, responsive dolly — prevents scroll from "running out of gas"
    controls.zoomSpeed = 1.4;
    controls.minDistance = 0.15;
    controls.maxDistance = Infinity;
    controls.zoomToCursor = true;
    controls.screenSpacePanning = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.maxPolarAngle = Math.PI * 0.499;
    controls.minPolarAngle = 0.02;
    controls.target.set(0, 8, 0);

    // Invert pitch for mouse path (OrbitControls uses private _rotateUp)
    const rotateUpPublic = controls.rotateUp.bind(controls);
    controls.rotateUp = (angle: number) => rotateUpPublic(-angle);
    if (typeof controls._rotateUp === "function") {
      const priv = controls._rotateUp.bind(controls);
      controls._rotateUp = (angle: number) => priv(-angle);
    }

    scene.add(new THREE.AmbientLight(0xb0b8c8, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.15);
    key.position.set(50, 60, 30);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-40, 25, -25);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 0.35));

    const grid = new THREE.GridHelper(80, 40, 0x334155, 0x1e293b);
    scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({
        color: 0x11151c,
        metalness: 0.15,
        roughness: 0.92,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
    const offset = new THREE.Vector3();

    const fitCamera = (box: THREE.Box3) => {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      const dist = maxDim * 1.35;
      camera.position.set(
        center.x + dist * 0.85,
        center.y + dist * 0.55,
        center.z + dist * 0.85,
      );
      controls!.target.copy(center);
      controls!.update();
      // Keep near/far sane for current framing
      camera.near = Math.max(0.05, dist / 1000);
      camera.far = Math.max(2000, dist * 40);
      camera.updateProjectionMatrix();
      grid.position.set(center.x, box.min.y, center.z);
      ground.position.set(center.x, box.min.y - 0.02, center.z);
      const gScale = Math.max(maxDim * 2.5, 40);
      ground.scale.set(gScale / 120, gScale / 120, 1);
      (grid as THREE.GridHelper).scale.setScalar(Math.max(maxDim / 40, 1));
    };

    sceneApi.current = {
      loaded: null,
      setSelected: (mark) => {
        if (!loaded) return;
        applyIfcSelection(loaded.meshes, loaded.byExpressId, mark);
      },
      setClip: (t) => {
        if (!loaded) return;
        const box = loaded.bounds;
        const minY = box.min.y;
        const maxY = box.max.y;
        const y = minY + (maxY - minY) * Math.max(0.05, Math.min(1, t));
        clipPlane.constant = y;
        for (const mesh of loaded.meshes) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.clippingPlanes = t >= 0.99 ? [] : [clipPlane];
        }
      },
      resetCamera: () => {
        if (loaded) fitCamera(loaded.bounds);
      },
      reorient: (yaw, zUp) => {
        if (!loaded) return;
        const bounds = reorientIfcGroup(loaded.group, {
          yaw: (yaw * Math.PI) / 180,
          forceZUp: zUp,
        });
        loaded.bounds.copy(bounds);
        fitCamera(bounds);
      },
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onClick = (ev: MouseEvent) => {
      if (!loaded || !renderer) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(loaded.meshes, false);
      if (hits[0]) {
        const mesh = hits[0].object as THREE.Mesh;
        const id = mesh.userData.expressID as number;
        const info = loaded.byExpressId.get(id);
        if (info) {
          setPicked(info);
          applyIfcSelection(loaded.meshes, loaded.byExpressId, info.mark);
          onSelectMember?.(info);
        }
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    const onDblClick = () => {
      void toggleFullscreen();
    };
    renderer.domElement.addEventListener("dblclick", onDblClick);

    // Capture pre-dolly distance (capture phase runs before OrbitControls).
    // If OC clamp leaves the camera stuck, apply a manual step so scroll
    // never dies out.
    let distBeforeWheel = 0;
    const onWheelCapture = () => {
      if (!controls) return;
      distBeforeWheel = camera.position.distanceTo(controls.target);
    };
    const onWheelBubble = (ev: WheelEvent) => {
      if (!controls) return;
      ev.preventDefault();
      requestAnimationFrame(() => {
        if (!controls) return;
        const after = camera.position.distanceTo(controls.target);
        const moved = Math.abs(after - distBeforeWheel);
        if (moved < 1e-4 && Math.abs(ev.deltaY) > 0) {
          const dir = offset.subVectors(camera.position, controls.target);
          const dist = Math.max(dir.length(), 0.5);
          dir.normalize();
          const step = Math.sign(ev.deltaY) * Math.max(dist * 0.12, 0.4);
          camera.position.addScaledVector(dir, step);
          if (camera.position.distanceTo(controls.target) < 0.2) {
            camera.position.copy(controls.target).addScaledVector(dir, 0.2);
          }
          controls.update();
        }
        const d = camera.position.distanceTo(controls.target);
        camera.near = Math.max(0.05, d / 2000);
        camera.far = Math.max(5000, d * 50);
        camera.updateProjectionMatrix();
      });
    };
    renderer.domElement.addEventListener("wheel", onWheelCapture, {
      capture: true,
      passive: true,
    });
    renderer.domElement.addEventListener("wheel", onWheelBubble, {
      passive: false,
    });

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (controls) {
        // Sanitize corrupt control state (NaN after extreme zoom/pan)
        if (
          !Number.isFinite(camera.position.x) ||
          !Number.isFinite(controls.target.x)
        ) {
          if (loaded) fitCamera(loaded.bounds);
        } else {
          controls.update();
        }
        // Clear any leftover dolly scale so it cannot stick mid-frame
        if (controls._scale !== undefined && controls._scale !== 1) {
          // update() already resets; force if something left it dirty
          if (!Number.isFinite(controls._scale)) controls._scale = 1;
        }
      }
      renderer?.render(scene, camera);
    };
    tick();

    const onResize = () => {
      if (!mount || !renderer) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await loadIfcModel(activeUrl, drawingsRef.current);
        if (disposed) {
          result.dispose();
          return;
        }
        loaded = result;
        scene.add(result.group);
        setMeshCount(result.meshCount);
        if (onMarksDiscovered) {
          const marks = [
            ...new Set(
              [...result.byExpressId.values()]
                .map((x) => x.mark)
                .filter((m) => m && m !== "-" && m.length > 0),
            ),
          ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          onMarksDiscovered(marks);
        }
        // Match loader default plan yaw (-90°)
        setYawDeg(-90);
        setForceZUp(null);
        fitCamera(result.bounds);
        if (sceneApi.current) sceneApi.current.loaded = result;
        applyIfcSelection(
          result.meshes,
          result.byExpressId,
          selectedMark ?? null,
        );
        sceneApi.current?.setClip(sectionY);
      } catch (e) {
        console.error(e);
        if (!disposed)
          setError(e instanceof Error ? e.message : "Failed to load IFC");
      } finally {
        if (!disposed) setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer?.domElement.removeEventListener("click", onClick);
      renderer?.domElement.removeEventListener("dblclick", onDblClick);
      renderer?.domElement.removeEventListener("wheel", onWheelCapture, true);
      renderer?.domElement.removeEventListener("wheel", onWheelBubble);
      controls?.dispose();
      loaded?.dispose();
      if (loaded) scene.remove(loaded.group);
      renderer?.dispose();
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

  useEffect(() => {
    sceneApi.current?.setSelected(selectedMark ?? picked?.mark ?? null);
  }, [selectedMark, picked]);

  // Update status colors when drawing register changes without reloading IFC geometry
  useEffect(() => {
    const loaded = sceneApi.current?.loaded;
    if (!loaded) return;
    const markMap = new Map<string, { status?: import("@/lib/types").DrawingStatus; onHold?: boolean; drawingId?: string }>();
    for (const d of drawings) {
      for (const mark of d.pieceMarks) {
        if (!markMap.has(mark)) {
          markMap.set(mark, {
            drawingId: d.id,
            status: d.status,
            onHold: d.status === "on_hold",
          });
        }
      }
    }
    for (const [id, info] of loaded.byExpressId) {
      const meta = markMap.get(info.mark);
      if (meta) {
        info.drawingId = meta.drawingId;
        info.status = meta.status;
        info.onHold = meta.onHold;
      }
    }
    applyIfcSelection(
      loaded.meshes,
      loaded.byExpressId,
      selectedMark ?? picked?.mark ?? null,
    );
  }, [drawings, selectedMark, picked]);

  useEffect(() => {
    sceneApi.current?.setClip(sectionY);
  }, [sectionY]);

  function onUpload(file: File | null) {
    if (!file) return;
    const name = file.name || "model.ifc";
    const lower = name.toLowerCase();
    if (lower.endsWith(".blend") || lower.endsWith(".blend1")) {
      setError(
        "Blender .blend files cannot be opened directly. In Blender use Bonsai (BlenderBIM) → Export → IFC (.ifc), then load that file.",
      );
      setShowBlenderHelp(true);
      return;
    }
    if (
      !lower.endsWith(".ifc") &&
      !lower.endsWith(".ifczip") &&
      !lower.endsWith(".zip") &&
      file.type !== "application/x-step" &&
      file.type !== "application/octet-stream" &&
      file.type !== "application/zip"
    ) {
      setError(
        `Unsupported file “${name}”. Export IFC from Blender (Bonsai) as .ifc or .ifczip — not glTF, FBX, or OBJ.`,
      );
      setShowBlenderHelp(true);
      return;
    }
    if (file.size > 120 * 1024 * 1024) {
      setError("IFC larger than 120 MB is not supported in the browser viewer.");
      return;
    }
    void (async () => {
      try {
        await idbPutFile(ifcUploadKey(), file);
        try {
          sessionStorage.setItem("piecemark-ifc-upload-name", name);
        } catch {
          /* ignore */
        }
      } catch {
        /* IDB optional */
      }
      if (customUrl) URL.revokeObjectURL(customUrl);
      const url = URL.createObjectURL(file);
      setCustomUrl(url);
      setModelId("custom");
      setLoading(true);
      setUploadedName(name);
      setError(null);
    })();
  }

  function onDropFiles(files: FileList | null) {
    if (!files?.length) return;
    onUpload(files[0] ?? null);
  }

  const display =
    picked ??
    (selectedMark && sceneApi.current?.loaded
      ? [...sceneApi.current.loaded.byExpressId.values()].find(
          (m) => m.mark === selectedMark,
        ) ?? null
      : null);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]",
        isFullscreen && "h-screen min-h-screen rounded-none border-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Box className="size-4 text-[var(--color-accent)]" />
            IFC model (web-ifc)
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {projectName} · drag orbit · scroll zoom · right-drag pan · dbl-click
            fullscreen
          </div>
        </div>
        <div className="max-w-[200px] truncate font-mono-num text-[11px] text-[var(--color-muted)]">
          {uploadedName
            ? uploadedName
            : customUrl
              ? "Uploaded IFC"
              : "No model loaded"}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]">
          <Upload className="size-3.5" />
          Load IFC / Blender
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc,.IFC,.ifczip,.zip,application/x-step,application/zip"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] p-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            title="Yaw left 90°"
            aria-label="Yaw left 90 degrees"
            onClick={() => {
              const next = yawDeg - 90;
              setYawDeg(next);
              sceneApi.current?.reorient(next, forceZUp);
            }}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <span className="min-w-[3.25rem] text-center font-mono-num text-[10px] text-[var(--color-muted)]">
            {yawDeg}°
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Yaw right 90°"
            aria-label="Yaw right 90 degrees"
            onClick={() => {
              const next = yawDeg + 90;
              setYawDeg(next);
              sceneApi.current?.reorient(next, forceZUp);
            }}
          >
            <RotateCw className="size-3.5" />
          </Button>
        </div>
        <Button
          size="sm"
          variant={forceZUp === true ? "secondary" : "ghost"}
          className="h-8 px-2 text-[11px]"
          title="Force IFC Z-up → Y-up (Blender / classic IFC)"
          onClick={() => {
            const next = forceZUp === true ? false : true;
            setForceZUp(next);
            sceneApi.current?.reorient(yawDeg, next);
          }}
        >
          Z-up fix
        </Button>
        <Button
          size="icon-sm"
          variant={showBlenderHelp ? "secondary" : "ghost"}
          title="Blender / Bonsai IFC import help"
          aria-label="Blender import help"
          onClick={() => setShowBlenderHelp((v) => !v)}
        >
          <Info className="size-4" />
        </Button>
        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          Cut
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={sectionY}
            onChange={(e) => setSectionY(Number(e.target.value))}
            className="w-16 accent-[var(--color-accent)]"
          />
        </label>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => sceneApi.current?.resetCamera()}
          aria-label="Reset camera"
          title="Reset camera"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant={isFullscreen ? "secondary" : "ghost"}
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </Button>
      </div>


      {showBlenderHelp && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-muted)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <strong className="text-[var(--color-fg)]">
              Import from Blender (Bonsai / BlenderBIM)
            </strong>
            <button
              type="button"
              className="text-[11px] text-[var(--color-accent)] hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose .ifc file…
            </button>
          </div>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
            <li>
              Install / enable <em>Bonsai</em> (formerly BlenderBIM) in Blender.
            </li>
            <li>
              File → Export → Industry Foundation Classes (.ifc) — IFC2x3 or
              IFC4. Do not upload .blend, glTF, FBX, or OBJ.
            </li>
            <li>
              Click <strong className="text-[var(--color-fg)]">Load IFC / Blender</strong>{" "}
              or drag-and-drop the .ifc onto the 3D view.
            </li>
            <li>
              If the model is on its side, click{" "}
              <strong className="text-[var(--color-fg)]">Z-up fix</strong>. Use
              yaw arrows if the plan faces the wrong way.
            </li>
            <li>
              Put fabrication piece marks in the element{" "}
              <strong className="text-[var(--color-fg)]">Tag</strong> field so
              they link to the drawing register.
            </li>
          </ol>
          <p className="mt-1.5 text-[11px] text-[var(--color-subtle)]">
            Tip: export only the structural steel package for faster browser
            loading.
          </p>
        </div>
      )}

      <div
        ref={mountRef}
        className={cn(
          "relative min-h-0 flex-1",
          dragOver && "ring-2 ring-inset ring-[var(--color-accent)]",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          onDropFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--color-accent)]/15 backdrop-blur-[1px]">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-bg)]/90 px-4 py-3 text-center text-sm font-medium text-[var(--color-fg)] shadow-lg">
              Drop IFC from Blender / Bonsai
              <div className="mt-0.5 text-xs font-normal text-[var(--color-muted)]">
                .ifc only — not .blend
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg)]/70 text-sm text-[var(--color-muted)] backdrop-blur-sm">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Parsing IFC geometry
            {uploadedName ? ` · ${uploadedName}` : ""}…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[var(--color-danger)]">
            <p className="max-w-md">{error}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setError(null);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="mr-1.5 size-3.5" />
                Load .ifc
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBlenderHelp(true)}
              >
                Blender help
              </Button>
            </div>
          </div>
        )}
        {isFullscreen && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/80">
            Esc to exit fullscreen
          </div>
        )}
        {uploadedName && !loading && !error && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(100%,280px)] truncate rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/85">
            Loaded: {uploadedName}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
        <Legend color="#34d399" label="IFC field" />
        <Legend color="#60a5fa" label="Issued fab" />
        <Legend color="#f59e0b" label="Hold" />
        <Legend color="#a78bfa" label="Brace" />
        <span className="ml-auto font-mono-num">
          {meshCount} IFC products meshed
          {uploadedName ? ` · ${uploadedName}` : ""}
        </span>
      </div>

      {display && (
        <div className="absolute bottom-14 left-3 right-3 max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-lg backdrop-blur-sm sm:left-auto">
          <div className="font-mono-num text-sm font-semibold">
            {display.mark}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
            {display.ifcType} · expressID {display.expressID}
            {display.onHold ? " · ON HOLD" : ""}
          </div>
          <div className="mt-1 text-xs text-[var(--color-subtle)]">
            {display.name}
          </div>
          {display.drawingId && (
            <Link
              to="/drawings/$drawingId"
              params={{ drawingId: display.drawingId }}
              className="mt-2 inline-block text-xs text-[var(--color-accent)] hover:underline"
            >
              Open linked drawing →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
