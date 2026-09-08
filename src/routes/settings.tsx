import { createFileRoute } from "@tanstack/react-router";
import { CloudDownload, CloudUpload, Download, Loader2 } from "lucide-react";
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
import { downloadJobPackage } from "@/lib/job-package";
import {
  pushAllLocal,
  reloadFromCloud,
  useCloudStatus,
} from "@/lib/supabase/persist";

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
  const upsertDrawingMarks = useAppStore((s) => s.upsertDrawingMarks);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const projects = useAppStore((s) => s.projects);
  const project =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const [busy, setBusy] = useState<"pull" | "push" | "csv" | null>(null);
  const cloud = useCloudStatus();
  const signedIn = authEnabled && !!user && !user.isDevFallback;
  const canPush = can(crewRole, "sync.push");
  const canAdmin = can(crewRole, "admin.settings");
  const canEdit = can(crewRole, "drawing.edit");

  async function onPull() {
    setBusy("pull");
    try {
      const res = await reloadFromCloud();
      if (res.empty) {
        toast.message("Cloud is empty for this account — nothing to load.");
        return;
      }
      toast.success(
        `Loaded ${res.pkg.projects.length} job(s), ${res.pkg.drawings.length} sheets from the cloud`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed — sign in if required");
    } finally {
      setBusy(null);
    }
  }

  async function onPush() {
    setBusy("push");
    try {
      await pushAllLocal();
      toast.success("This device's jobs were merged into the cloud");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — sign in if required");
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
      title="Settings & cloud"
      subtitle="Account, cloud data, CSV import, production pilot tools"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold">Company & crew role</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Soft RBAC for this station. GC view is read-only for mutations.
            Role and company profile save to your account when signed in.
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
          <h2 className="text-sm font-semibold">Cloud (Supabase)</h2>
          <p className="text-sm text-[var(--color-muted)]">
            When you are signed in, every change saves to your account about a
            second after you make it — jobs, sheets, RFIs, submittals,
            transmittals, and uploaded PDFs. Sign in on another station and the
            same data is there. Nothing is saved to the cloud while signed out.
          </p>
          <div className="text-xs text-[var(--color-subtle)]">
            Account:{" "}
            {isPending
              ? "…"
              : user
                ? user.displayName || user.primaryEmail || user.id
                : "signed out"}
            {" · "}
            Cloud:{" "}
            {!authEnabled
              ? "off (local demo mode)"
              : cloud.state === "saving"
                ? "saving…"
                : cloud.state === "loading"
                  ? "loading…"
                  : cloud.state === "error"
                    ? `error — ${cloud.error ?? "unknown"}`
                    : cloud.state === "idle"
                      ? cloud.lastSavedAt
                        ? `saved ${new Date(cloud.lastSavedAt).toLocaleTimeString()}`
                        : "up to date"
                      : "not connected"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy || !signedIn}
              onClick={() => void onPull()}
            >
              {busy === "pull" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudDownload className="size-3.5" />
              )}
              Refresh from cloud
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy || !signedIn || !canPush}
              onClick={() => {
                const ok = window.confirm(
                  "Merge every job on this device into the cloud by id? Rows with the same id are overwritten with this device's copy.",
                );
                if (ok) void onPush();
              }}
            >
              {busy === "push" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudUpload className="size-3.5" />
              )}
              Upload this device's data
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadJobPackage(exportPackage())}
            >
              <Download className="size-3.5" />
              Export JSON backup
            </Button>
          </div>
          {!signedIn && authEnabled && (
            <p className="text-xs text-[var(--color-warn)]">
              You are not signed in — changes stay on this device only.
            </p>
          )}
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
            Uploaded sheets (PDF / image) go to private cloud storage, up to
            100 MB per file, and are cached on this device for instant opening.
            IFC models stay on this device.
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
