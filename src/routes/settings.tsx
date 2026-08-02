import { createFileRoute } from "@tanstack/react-router";
import { CloudDownload, CloudUpload, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { parsePieceCsv } from "@/lib/import/csv-pieces";
import { can, roleSummary } from "@/lib/permissions";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { raiseSyncConflict } from "@/lib/sync-conflict-store";
import {
  getLocalRevision,
  isAutoSyncEnabled,
  isLocalDirty,
  rememberAllRemoteSheets,
  setAutoSyncEnabled,
  setLocalRevision,
  syncPull,
  syncPush,
} from "@/lib/workspace-sync";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const exportPackage = useAppStore((s) => s.exportPackage);
  const crewRole = useAppStore((s) => s.crewRole);
  const orgName = useAppStore((s) => s.orgName);
  const orgRfiEmail = useAppStore((s) => s.orgRfiEmail);
  const setCrewRole = useAppStore((s) => s.setCrewRole);
  const setOrgProfile = useAppStore((s) => s.setOrgProfile);
  const importPackage = useAppStore((s) => s.importPackage);
  const upsertDrawingMarks = useAppStore((s) => s.upsertDrawingMarks);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const project =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const [busy, setBusy] = useState<"pull" | "push" | "force" | "csv" | null>(
    null,
  );
  const [rev, setRev] = useState(() => getLocalRevision());
  const [autoSync, setAutoSync] = useState(() => isAutoSyncEnabled());
  const canPush = can(crewRole, "sync.push");
  const canAdmin = can(crewRole, "admin.settings");
  const canEdit = can(crewRole, "drawing.edit");

  async function onPull(forceReplace = false) {
    setBusy("pull");
    try {
      const res = await syncPull();
      if (!res.package) {
        toast.message("No cloud workspace yet — push this device first.");
        return;
      }
      if (isLocalDirty() && !forceReplace) {
        raiseSyncConflict({
          reason: "dirty_remote",
          localRevision: getLocalRevision(),
          remoteRevision: res.revision,
          remoteUpdatedAt: res.updatedAt,
          remotePackage: res.package,
        });
        return;
      }
      importPackage(res.package, "replace");
      setLocalRevision(res.revision);
      setRev(res.revision);
      await rememberAllRemoteSheets();
      toast.success(
        `Pulled ${res.package.projects.length} job(s), ${res.package.drawings.length} sheets (rev ${res.revision})`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Pull failed — sign in if required",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onPush(force = false) {
    setBusy(force ? "force" : "push");
    try {
      const result = await syncPush(exportPackage(), {
        force,
        crewRole,
        raiseUi: !force,
      });
      setRev(result.revision);
      if (result.accepted) {
        toast.success(`Pushed workspace revision ${result.revision}`);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Push failed — sign in if required",
      );
    } finally {
      setBusy(null);
    }
  }

  async function onCsv(file: File | null) {
    if (!file || !project) return;
    if (!canEdit) {
      toast.error("Your station role cannot import CSV");
      return;
    }
    setBusy("csv");
    try {
      const text = await file.text();
      const rows = parsePieceCsv(text);
      if (rows.length === 0) {
        toast.error("No piece rows found in CSV");
        return;
      }
      const result = upsertDrawingMarks(
        project.id,
        rows.map((r) => ({
          mark: r.mark,
          drawingNumber: r.drawingNumber,
          title: r.title,
          setCode: r.setCode,
        })),
      );
      toast.success(
        `CSV: ${rows.length} rows → ${result.marksAdded} marks, ${result.sheetsCreated} new sheet(s)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV import failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="Settings & sync"
      subtitle="Cloud workspace, CSV import, production pilot tools"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold">Company & crew role</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Soft RBAC for this station. GC view is read-only for mutations.
            Role is stored on this device (and in cloud package when you push).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="org-name"
                className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-subtle)]"
              >
                Company / fab name
              </label>
              <Input
                id="org-name"
                name="orgName"
                aria-label="Company name"
                value={orgName}
                disabled={!canAdmin && !canEdit}
                onChange={(e) => setOrgProfile({ orgName: e.target.value })}
              />
            </div>
            <div>
              <label
                htmlFor="org-rfi-email"
                className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-subtle)]"
              >
                Default RFI email
              </label>
              <Input
                id="org-rfi-email"
                name="orgRfiEmail"
                type="email"
                aria-label="Default RFI email"
                placeholder="engineer@example.com"
                value={orgRfiEmail}
                disabled={!canAdmin && !canEdit}
                onChange={(e) => setOrgProfile({ orgRfiEmail: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="crew-role"
                className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-subtle)]"
              >
                This station role
              </label>
              <Select
                id="crew-role"
                name="crewRole"
                aria-label="Crew role"
                value={crewRole}
                onChange={(e) => setCrewRole(e.target.value as UserRole)}
              >
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]} — {roleSummary(r)}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-[var(--color-subtle)]">
                Station role is soft UI control (not server security). Cloud data
                is still scoped to your signed-in account.
              </p>
            </div>
          </div>
          {!can(crewRole, "job.create") && (
            <p className="text-xs text-[var(--color-warn)]">
              Current role cannot create jobs. Switch to PM or Admin for full
              pilot control.
            </p>
          )}
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold">
            Cloud workspace (PGLite / Postgres)
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            Push stores the full job package server-side for your signed-in user
            (or the preview dev user when auth is off). Stale pushes are rejected
            — pull first, or use Force push only when you intend to overwrite
            the cloud.
          </p>
          <div className="text-xs text-[var(--color-subtle)]">
            Local revision: <span className="font-mono-num">{rev}</span>
            {" · "}
            Dirty: {isLocalDirty() ? "yes" : "no"}
            {" · "}
            Auth: {authEnabled ? "on" : "off (dev user)"}
            {" · "}
            User:{" "}
            {isPending
              ? "…"
              : user
                ? user.displayName || user.primaryEmail || user.id
                : "signed out"}
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <input
              id="auto-sync-toggle"
              name="autoSync"
              type="checkbox"
              checked={autoSync}
              disabled={!canPush}
              aria-label="Enable auto-sync push"
              className="size-4 accent-[var(--color-accent)]"
              onChange={(e) => {
                const on = e.target.checked;
                setAutoSync(on);
                setAutoSyncEnabled(on);
                toast.message(
                  on ? "Auto-sync on (debounced push)" : "Auto-sync off",
                );
              }}
            />
            Auto-push after changes (~2.5s debounce)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!!busy || !canPush}
              onClick={() => void onPush(false)}
            >
              {busy === "push" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudUpload className="size-3.5" />
              )}
              Push to cloud
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => void onPull(false)}
            >
              {busy === "pull" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudDownload className="size-3.5" />
              )}
              Pull from cloud
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy || !canPush}
              onClick={() => {
                const ok = window.confirm(
                  "Force push overwrites the cloud with this device even if cloud is newer. Continue?",
                );
                if (ok) void onPush(true);
              }}
            >
              {busy === "force" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudUpload className="size-3.5" />
              )}
              Force push
            </Button>
          </div>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold">CSV piece mark import</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Columns:{" "}
            <code className="text-[var(--color-fg)]">
              mark,drawing,title,set,tonnage
            </code>
            . Creates shop sheets on the active job when drawing numbers are new.
          </p>
          <label className="inline-flex cursor-pointer">
            <Button
              size="sm"
              variant="secondary"
              asChild
              disabled={!!busy || !canEdit}
            >
              <span>
                {busy === "csv" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Upload CSV
              </span>
            </Button>
            <input
              id="csv-piece-import"
              name="csvPieces"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Import piece mark CSV"
              disabled={!canEdit}
              onChange={(e) => {
                void onCsv(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </section>

        <section className="panel space-y-2 p-5 text-sm text-[var(--color-muted)]">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">
            Cloud file size
          </h2>
          <p>
            Sheets upload to the cloud in multi-part chunks up to ~28MB. Larger
            PDFs/IFCs stay on this device (IndexedDB) with metadata still
            syncing in the job package.
          </p>
        </section>

        <section className="panel space-y-2 p-5 text-sm text-[var(--color-muted)]">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">
            Print packages
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Field package: open Field Package → Print field set (browser print
              → PDF)
            </li>
            <li>
              Transmittal: open a transmittal → Print (browser print → PDF)
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
