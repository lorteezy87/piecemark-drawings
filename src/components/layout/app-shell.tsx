import { Link, useRouterState } from "@tanstack/react-router";
import {
  Box,
  BookOpen,
  Building2,
  ClipboardList,
  Factory,
  FileStack,
  HardHat,
  Hash,
  LayoutDashboard,
  Menu,
  MessageSquareWarning,
  OctagonAlert,
  Route as RouteIcon,
  Search,
  Send,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { SyncConflictDialog } from "@/components/sync/sync-conflict-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { idbGetFile, idbPutFile, sheetAssetKey } from "@/lib/idb-files";
import { downloadSheetFromServer } from "@/lib/workspace-sync";
import { useAppStore } from "@/lib/store";
import { authEnabled } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { USER_ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const nav: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, exact: true },
  { to: "/drawings", label: "Drawing Sets", icon: FileStack },
  { to: "/viewer", label: "Sheet / IFC Viewer", icon: Box },
  { to: "/ids", label: "IDS Validation", icon: ShieldCheck },
  { to: "/pieces", label: "Piece Marks", icon: Hash },
  { to: "/shop", label: "Shop Package", icon: Factory },
  { to: "/field", label: "Field Package", icon: HardHat },
  { to: "/sequences", label: "Erection Sequences", icon: RouteIcon },
  { to: "/transmittals", label: "Transmittals", icon: Send },
  { to: "/submittals", label: "Submittals", icon: ClipboardList },
  { to: "/rfis", label: "RFI Log", icon: MessageSquareWarning },
  { to: "/holds", label: "Holds & Blockers", icon: OctagonAlert },
  { to: "/projects", label: "Jobs", icon: Building2 },
  { to: "/settings", label: "Settings & Sync", icon: Settings },
  { to: "/help", label: "How to use", icon: BookOpen },
];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useAutoSync();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projects = useAppStore((s) => s.projects);
  const crewRole = useAppStore((s) => s.crewRole);
  const orgName = useAppStore((s) => s.orgName);
  const setSessionActor = useAppStore((s) => s.setSessionActor);
  const { user } = useCurrentUserState();
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const drawings = useAppStore((s) => s.drawings);
  const sheetAssets = useAppStore((s) => s.sheetAssets);
  const setSheetAsset = useAppStore((s) => s.setSheetAsset);

  useEffect(() => {
    if (!user) return;
    const name =
      user.displayName || user.primaryEmail?.split("@")[0] || "Station";
    setSessionActor(name);
  }, [user, setSessionActor]);


  // Restore PDF/image blobs from IndexedDB, then cloud file store
  const hydrateOnce = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const d of drawings) {
        if (!d.sheetUploadName || sheetAssets[d.id]) continue;
        let blob = await idbGetFile(sheetAssetKey(d.id));
        let name = d.sheetUploadName;
        let mime = d.sheetUploadMime || "application/pdf";
        if (!blob) {
          const remote = await downloadSheetFromServer(d.id);
          if (remote) {
            blob = remote.blob;
            name = remote.name;
            mime = remote.mime;
            await idbPutFile(sheetAssetKey(d.id), blob);
          }
        }
        if (!blob || cancelled) continue;
        const url = URL.createObjectURL(blob);
        setSheetAsset(d.id, {
          drawingId: d.id,
          name,
          mime: mime || blob.type || "application/pdf",
          url,
          size: blob.size,
          uploadedAt: new Date().toISOString(),
        });
      }
      hydrateOnce.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [drawings, sheetAssets, setSheetAsset]);
  const setFilters = useAppStore((s) => s.setFilters);
  const filters = useAppStore((s) => s.filters);
  const rfis = useAppStore((s) => s.rfis);

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const openHolds = useMemo(
    () =>
      drawings.filter(
        (d) => d.projectId === project?.id && d.status === "on_hold",
      ).length,
    [drawings, project?.id],
  );
  const openRfis = useMemo(
    () =>
      rfis.filter((r) => r.projectId === project?.id && r.status === "open")
        .length,
    [rfis, project?.id],
  );

  return (
    <>
      <SyncConflictDialog />
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] lg:flex">
          <div className="border-b border-[var(--color-border)] px-5 py-5">
            <Link to="/" className="block">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-subtle)]">
                Steel fab & erection
              </div>
              <div className="mt-1 font-semibold tracking-tight text-[var(--color-fg)]">
                PieceMark
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                Drawings control
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                {orgName || "Company"}
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                {USER_ROLE_LABELS[crewRole]}
              </div>
            </Link>
          </div>

          <div className="space-y-2 border-b border-[var(--color-border)] px-4 py-4">
            <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
              Active job
            </label>
            <Select
              id="job-select"
              name="projectId"
              value={project?.id ?? ""}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Select job"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber} — {p.name.split("—")[0].trim()}
                </option>
              ))}
            </Select>
            {project && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-muted)]">
                <div className="font-mono-num text-[var(--color-fg)]">
                  {project.jobNumber}
                </div>
                <div className="mt-1 line-clamp-2">{project.client}</div>
                <div className="mt-2 flex gap-3 text-[11px]">
                  <span className="text-[var(--color-warn)]">
                    {openHolds} holds
                  </span>
                  <span className="text-[var(--color-info)]">
                    {openRfis} open RFIs
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1 border-b border-[var(--color-border)] px-3 py-2">
            <UserButton />
            {authEnabled && (
              <Link
                to="/login"
                className="block text-[11px] text-[var(--color-muted)] underline-offset-2 hover:underline"
              >
                Account / sign in
              </Link>
            )}
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--color-border)] p-4 text-[11px] leading-relaxed text-[var(--color-subtle)]">
            Built for detailers, fab shops, and ironworkers — not generic PM.
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-md">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="truncate text-xs text-[var(--color-muted)] sm:text-sm">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="hidden max-w-xs flex-1 md:block lg:max-w-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
                  <Input
                    value={filters.query}
                    onChange={(e) => setFilters({ query: e.target.value })}
                    placeholder="Set name, piece mark, sheet #…"
                    className="h-9 pl-9"
                    aria-label="Search drawings"
                  />
                </div>
              </div>

              {actions}
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-[var(--color-bg-elevated)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
              <div>
                <div className="font-semibold">PieceMark</div>
                <div className="text-xs text-[var(--color-muted)]">
                  Drawings control
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="border-b border-[var(--color-border)] p-4">
              <Select
                value={project?.id ?? ""}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setOpen(false);
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.jobNumber}
                  </option>
                ))}
              </Select>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
