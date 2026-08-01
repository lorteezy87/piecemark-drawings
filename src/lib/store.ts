import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  drawingSets as seedDrawingSets,
  drawings as seedDrawings,
  markups as seedMarkups,
  projects as seedProjects,
  revisions as seedRevisions,
  rfis as seedRfis,
  sequences as seedSequences,
  submittals as seedSubmittals,
} from "@/data/seed";
import type {
  Drawing,
  DrawingSet,
  DrawingStatus,
  DrawingType,
  Markup,
  Project,
  Revision,
  RFI,
  Sequence,
  Submittal,
} from "@/lib/types";
import { FAB_READY_STATUSES, STATUS_SEVERITY } from "@/lib/types";

export interface DrawingFilters {
  query: string;
  type: DrawingType | "all";
  status: DrawingStatus | "all";
  sequenceId: string | "all";
  setId: string | "all";
  holdsOnly: boolean;
}

interface AppState {
  projects: Project[];
  sequences: Sequence[];
  drawingSets: DrawingSet[];
  drawings: Drawing[];
  revisions: Revision[];
  rfis: RFI[];
  submittals: Submittal[];
  markups: Markup[];
  selectedProjectId: string | null;
  filters: DrawingFilters;
  setSelectedProjectId: (id: string | null) => void;
  setFilters: (partial: Partial<DrawingFilters>) => void;
  resetFilters: () => void;
  updateDrawingStatus: (id: string, status: DrawingStatus, note?: string) => void;
  updateSetStatus: (id: string, status: DrawingStatus) => void;
  addMarkup: (markup: Omit<Markup, "id">) => void;
  resolveMarkup: (id: string) => void;
  updateRfiStatus: (id: string, status: RFI["status"], answer?: string) => void;
  resetDemoData: () => void;
}

const defaultFilters: DrawingFilters = {
  query: "",
  type: "all",
  status: "all",
  sequenceId: "all",
  setId: "all",
  holdsOnly: false,
};

function seedState() {
  return {
    projects: seedProjects,
    sequences: seedSequences,
    drawingSets: seedDrawingSets,
    drawings: seedDrawings,
    revisions: seedRevisions,
    rfis: seedRfis,
    submittals: seedSubmittals,
    markups: seedMarkups,
    selectedProjectId: seedProjects[0]?.id ?? null,
    filters: { ...defaultFilters },
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...seedState(),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) =>
        set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),
      updateDrawingStatus: (id, status, note) =>
        set((s) => ({
          drawings: s.drawings.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status,
                  holdReason:
                    status === "on_hold" ? note ?? d.holdReason : undefined,
                  notes: note && status !== "on_hold" ? note : d.notes,
                  issuedDate:
                    status === "issued_for_fab" ||
                    status === "issued_for_erection"
                      ? (d.issuedDate ?? new Date().toISOString().slice(0, 10))
                      : d.issuedDate,
                }
              : d,
          ),
        })),
      updateSetStatus: (id, status) =>
        set((s) => ({
          drawingSets: s.drawingSets.map((ds) =>
            ds.id === id
              ? {
                  ...ds,
                  status,
                  issuedDate:
                    status === "issued_for_fab" ||
                    status === "issued_for_erection"
                      ? (ds.issuedDate ?? new Date().toISOString().slice(0, 10))
                      : ds.issuedDate,
                }
              : ds,
          ),
        })),
      addMarkup: (markup) =>
        set((s) => ({
          markups: [
            {
              ...markup,
              id: `mk-${Date.now()}`,
            },
            ...s.markups,
          ],
        })),
      resolveMarkup: (id) =>
        set((s) => ({
          markups: s.markups.map((m) =>
            m.id === id ? { ...m, resolved: true } : m,
          ),
        })),
      updateRfiStatus: (id, status, answer) =>
        set((s) => ({
          rfis: s.rfis.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  answer: answer ?? r.answer,
                  answeredDate:
                    status === "answered" || status === "closed"
                      ? (r.answeredDate ??
                        new Date().toISOString().slice(0, 10))
                      : r.answeredDate,
                }
              : r,
          ),
        })),
      resetDemoData: () => set(seedState()),
    }),
    {
      name: "piecemark-drawings-v2",
      partialize: (s) => ({
        drawings: s.drawings,
        drawingSets: s.drawingSets,
        markups: s.markups,
        rfis: s.rfis,
        selectedProjectId: s.selectedProjectId,
      }),
    },
  ),
);

export function useSelectedProject() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  return projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
}

export function sheetsForSet(drawings: Drawing[], setId: string) {
  return drawings
    .filter((d) => d.setId === setId)
    .sort((a, b) => a.sheetIndex - b.sheetIndex || a.number.localeCompare(b.number));
}

export function rolledSetStatus(sheets: Drawing[], fallback: DrawingStatus): DrawingStatus {
  if (sheets.length === 0) return fallback;
  return sheets.reduce((worst, d) =>
    STATUS_SEVERITY[d.status] < STATUS_SEVERITY[worst] ? d.status : worst,
  sheets[0]!.status);
}

export function filterDrawings(
  drawings: Drawing[],
  filters: DrawingFilters,
  projectId?: string | null,
) {
  return drawings.filter((d) => {
    if (projectId && d.projectId !== projectId) return false;
    if (filters.setId !== "all" && d.setId !== filters.setId) return false;
    if (filters.type !== "all" && d.type !== filters.type) return false;
    if (filters.status !== "all" && d.status !== filters.status) return false;
    if (filters.sequenceId !== "all" && d.sequenceId !== filters.sequenceId)
      return false;
    if (filters.holdsOnly && d.status !== "on_hold") return false;
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      const hay = [
        d.number,
        d.title,
        d.detailer ?? "",
        d.area ?? "",
        ...d.pieceMarks,
        ...d.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterDrawingSets(
  sets: DrawingSet[],
  drawings: Drawing[],
  filters: DrawingFilters,
  projectId?: string | null,
) {
  return sets
    .filter((set) => {
      if (projectId && set.projectId !== projectId) return false;
      if (filters.setId !== "all" && set.id !== filters.setId) return false;
      if (filters.sequenceId !== "all" && set.sequenceId !== filters.sequenceId)
        return false;
      if (filters.type !== "all" && set.type !== filters.type) {
        // also allow if any child sheet matches type
        const kids = drawings.filter((d) => d.setId === set.id);
        if (!kids.some((d) => d.type === filters.type)) return false;
      }

      const sheets = sheetsForSet(drawings, set.id);
      const effectiveStatus = rolledSetStatus(sheets, set.status);

      if (filters.holdsOnly) {
        if (
          effectiveStatus !== "on_hold" &&
          !sheets.some((d) => d.status === "on_hold")
        )
          return false;
      }
      if (filters.status !== "all") {
        if (
          effectiveStatus !== filters.status &&
          !sheets.some((d) => d.status === filters.status)
        )
          return false;
      }

      if (filters.query.trim()) {
        const q = filters.query.trim().toLowerCase();
        const setHay = [set.code, set.name, set.description ?? "", set.detailer ?? ""]
          .join(" ")
          .toLowerCase();
        if (setHay.includes(q)) return true;
        const matchingSheets = filterDrawings(
          drawings,
          { ...filters, setId: set.id },
          projectId,
        );
        return matchingSheets.length > 0;
      }
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function projectMetrics(projectId: string) {
  const state = useAppStore.getState();
  const drawings = state.drawings.filter((d) => d.projectId === projectId);
  const drawingSets = state.drawingSets.filter((d) => d.projectId === projectId);
  const rfis = state.rfis.filter((r) => r.projectId === projectId);
  const submittals = state.submittals.filter((s) => s.projectId === projectId);
  const sequences = state.sequences.filter((s) => s.projectId === projectId);

  const total = drawings.length;
  const fabReady = drawings.filter((d) =>
    FAB_READY_STATUSES.includes(d.status),
  ).length;
  const onHold = drawings.filter((d) => d.status === "on_hold").length;
  const revise = drawings.filter((d) => d.status === "revise_resubmit").length;
  const inReview = drawings.filter((d) =>
    ["submitted", "internal_review"].includes(d.status),
  ).length;
  const openRfis = rfis.filter((r) => r.status === "open").length;
  const openSubs = submittals.filter((s) =>
    ["submitted", "under_review", "resubmit"].includes(s.status),
  ).length;
  const unresolvedMarkups = state.markups.filter(
    (m) => !m.resolved && drawings.some((d) => d.id === m.drawingId),
  ).length;
  const setsOnHold = drawingSets.filter((s) => {
    const sheets = sheetsForSet(drawings, s.id);
    return (
      s.status === "on_hold" || sheets.some((d) => d.status === "on_hold")
    );
  }).length;

  return {
    total,
    setCount: drawingSets.length,
    setsOnHold,
    fabReady,
    fabReadyPct: total ? Math.round((fabReady / total) * 100) : 0,
    onHold,
    revise,
    inReview,
    openRfis,
    openSubs,
    unresolvedMarkups,
    sequences,
    drawings,
    drawingSets,
    rfis,
    submittals,
  };
}
