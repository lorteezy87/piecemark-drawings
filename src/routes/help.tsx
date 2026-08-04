import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box,
  Building2,
  CheckCircle2,
  Cloud,
  FileStack,
  Hash,
  MessageSquareWarning,
  Printer,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

const steps = [
  {
    n: 1,
    title: "Set up this station",
    icon: Settings,
    to: "/settings",
    body: [
      "Open Settings & Sync.",
      "Set Company name and (optional) RFI email.",
      "Choose This station role: Detailer for day-to-day drawings work, PM for job setup, Admin for full control.",
      "Leave Auto-push ON so changes go to the cloud a few seconds after you edit.",
    ],
  },
  {
    n: 2,
    title: "Clear demos (optional) and create your job",
    icon: Building2,
    to: "/projects",
    body: [
      "Open Jobs.",
      "Click Remove demos if you don’t want the sample PMC / warehouse / office jobs.",
      "Or Delete job on any card you don’t need.",
      "Click New job → enter Job number, name, GC, engineer, location, tonnage → Create job.",
      "Click Make active so the header shows that job.",
    ],
  },
  {
    n: 3,
    title: "Build the drawing register",
    icon: FileStack,
    to: "/drawings",
    body: [
      "Open Drawing Sets.",
      "Add sheet: enter set code (e.g. SET-SHOP), sheet number (E-101), title → create.",
      "Or Upload PDFs: multi-page PDFs split into one sheet per page; multi-select also creates one sheet per file. Names like E-101.pdf match empty sheets; otherwise new rows under SET-UPLOAD.",
      "Delete set removes the whole package; trash icon on a row deletes one sheet.",
    ],
  },
  {
    n: 4,
    title: "View real sheets",
    icon: Upload,
    to: "/viewer",
    body: [
      "Open Sheet / IFC Viewer → Sheet mode.",
      "Pick the sheet in the dropdown.",
      "Upload PDF (or image) for that sheet — filename does not matter when a sheet is already selected.",
      "Pan / zoom the real drawing. No generated placeholders — upload is required to view a sheet.",
    ],
  },
  {
    n: 5,
    title: "Load an IFC model (3D)",
    icon: Box,
    to: "/viewer",
    body: [
      "In the Viewer, switch to IFC mode.",
      "Upload an .ifc or .ifczip (no sample models — empty until you upload). Export from Tekla, SDS/2, Revit, or Blender Bonsai — not .blend.",
      "Orbit: left-drag. Pan: right-drag or middle. Zoom: scroll (no “run out of gas” — zoom always works).",
      "Click a member to see properties. Fullscreen uses the button in the viewer chrome.",
      "Piece status colors follow the drawing register (hold = warning, etc.).",
    ],
  },
  {
    n: 6,
    title: "Piece marks & holds",
    icon: Hash,
    to: "/pieces",
    body: [
      "Piece Marks lists marks from sheets and IFC tags.",
      "Import CSV from Settings if you have a shop list (columns: mark, sheet, weight…).",
      "Use Holds & Blockers when a sheet can’t fab/erect — set status On hold with a reason.",
      "Held pieces show in Command Center and on the IFC coloring.",
    ],
  },
  {
    n: 7,
    title: "RFIs, submittals, transmittals",
    icon: MessageSquareWarning,
    to: "/rfis",
    body: [
      "RFI Log: create RFIs linked to sheets; track open/answered.",
      "Submittals: package sets for engineer review; update status (submitted, AAN, approved, revise).",
      "Transmittals: issue outbound packages to GC/shop/field; open Print for a clean PDF-style view.",
    ],
  },
  {
    n: 8,
    title: "Shop & field packages + print",
    icon: Printer,
    to: "/shop",
    body: [
      "Shop Package: fab-oriented view of approved / ready shop sheets.",
      "Field Package: erection sequence + sheets for the field.",
      "Sequences: plan erection order and link sets/sheets.",
      "Use browser Print (or the Print routes) for paper/PDF field copies.",
    ],
  },
  {
    n: 9,
    title: "IDS model check (optional)",
    icon: ShieldCheck,
    to: "/ids",
    body: [
      "IDS Validation checks IFC elements against the steel fab/erection ruleset.",
      "Review the non-compliant table (missing properties, wrong types).",
      "Use it before submittal when the GC/owner requires model QA.",
    ],
  },
  {
    n: 10,
    title: "Sync across devices",
    icon: Cloud,
    to: "/settings",
    body: [
      "Sign in with the same account on each device.",
      "With Auto-push ON, edits leave this station automatically.",
      "Push to cloud = save now. Pull from cloud = load the latest package.",
      "If two stations conflict, a dialog appears: Use cloud, Merge both, or Keep mine (force).",
      "Force push only when you intend to overwrite the cloud.",
      "Sheets up to ~28MB upload to the cloud; larger files stay in this browser’s storage.",
    ],
  },
];

function HelpPage() {
  return (
    <AppShell
      title="How to use PieceMark"
      subtitle="Steel fab & erection drawings control — pilot walkthrough"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="panel space-y-3 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <CheckCircle2 className="size-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                What this app is for
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
                PieceMark is a drawings control desk for steel fabrication and
                erection subcontractors — not a generic project manager. You
                track shop/erection sheets, piece marks, holds, RFIs,
                submittals, transmittals, sequences, and IFC models for a job.
              </p>
            </div>
          </div>
          <ol className="grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-2">
            <li className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <span className="font-medium text-[var(--color-fg)]">
                Active job
              </span>{" "}
              — selected in the header / Jobs; everything filters to it.
            </li>
            <li className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <span className="font-medium text-[var(--color-fg)]">
                Drawing set
              </span>{" "}
              — package (shop, erection, anchors…). Sheets live under sets.
            </li>
            <li className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <span className="font-medium text-[var(--color-fg)]">Sheet</span>{" "}
              — one drawing number (E-101, S-301) with status, rev, pieces.
            </li>
            <li className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <span className="font-medium text-[var(--color-fg)]">
                Cloud package
              </span>{" "}
              — full job data for your signed-in account; PDFs multi-part.
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Step-by-step first job
          </h2>
          <ol className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.n} className="panel p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] font-mono-num text-sm font-semibold">
                        {step.n}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Icon className="size-4 text-[var(--color-accent)]" />
                          <h3 className="font-semibold tracking-tight">
                            {step.title}
                          </h3>
                        </div>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-[var(--color-muted)]">
                          {step.body.map((line) => (
                            <li key={line} className="leading-relaxed">
                              {line}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link to={step.to}>Open</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="panel space-y-3 p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight">
            Daily checklist
          </h2>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
              Confirm active job in the header.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
              Pull if another station may have pushed overnight.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
              Update statuses / holds as fab and field report.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
              Log RFIs the same day; issue transmittals when packages leave.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]" />
              Glance Command Center for open holds and RFIs before end of day.
            </li>
          </ul>
        </section>

        <section className="panel space-y-3 p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight">
            What not to do
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--color-muted)]">
            <li>
              Don’t use Force push unless this station should overwrite the
              cloud.
            </li>
            <li>
              Don’t upload .blend / glTF / FBX as IFC — export true IFC from the
              BIM tool.
            </li>
            <li>
              Don’t expect multi-company sharing yet — cloud is per signed-in
              user account.
            </li>
            <li>
              Don’t rely on Reset demo in production — it reloads sample data
              and wipes local edits.
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-2 pb-8">
          <Button asChild>
            <Link to="/projects">Start at Jobs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Command Center</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/settings">Settings & Sync</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
