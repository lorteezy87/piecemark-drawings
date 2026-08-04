/**
 * Manual title-block field map.
 * Rects are normalized 0–1 with origin at top-left (UI space).
 * PDF.js text uses bottom-left — convert when extracting.
 */
export type NormRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TitleBlockField = "title" | "sheetNo" | "rev";

export type TitleBlockMap = {
  projectId: string;
  name: string;
  title: NormRect | null;
  sheetNo: NormRect | null;
  rev: NormRect | null;
  /** Page width/height ratio when map was drawn (for display only) */
  pageAspect?: number;
  updatedAt: string;
};

export const TITLE_BLOCK_FIELD_LABELS: Record<TitleBlockField, string> = {
  title: "Title",
  sheetNo: "Sheet no.",
  rev: "Rev",
};

export const TITLE_BLOCK_FIELD_COLORS: Record<
  TitleBlockField,
  { stroke: string; fill: string }
> = {
  title: { stroke: "#6a8fad", fill: "rgba(106,143,173,0.18)" },
  sheetNo: { stroke: "#b8924a", fill: "rgba(184,146,74,0.18)" },
  rev: { stroke: "#5f8f6e", fill: "rgba(95,143,110,0.18)" },
};

export function emptyTitleBlockMap(projectId: string): TitleBlockMap {
  return {
    projectId,
    name: "Title block",
    title: null,
    sheetNo: null,
    rev: null,
    updatedAt: new Date().toISOString(),
  };
}

export function hasAnyRegion(map: TitleBlockMap | null | undefined): boolean {
  if (!map) return false;
  return !!(map.title || map.sheetNo || map.rev);
}

/** Point (top-left normalized) inside rect with optional padding. */
export function pointInNormRect(
  px: number,
  py: number,
  r: NormRect,
  pad = 0.01,
): boolean {
  return (
    px >= r.x - pad &&
    px <= r.x + r.w + pad &&
    py >= r.y - pad &&
    py <= r.y + r.h + pad
  );
}

/** Convert PDF.js item (origin bottom-left) to top-left normalized. */
export function pdfItemToTopLeftNorm(
  x: number,
  y: number,
  pageW: number,
  pageH: number,
): { nx: number; ny: number } {
  return {
    nx: pageW > 0 ? x / pageW : 0,
    ny: pageH > 0 ? 1 - y / pageH : 0,
  };
}

export function clampNormRect(r: NormRect): NormRect {
  const x = Math.min(1, Math.max(0, r.x));
  const y = Math.min(1, Math.max(0, r.y));
  const w = Math.min(1 - x, Math.max(0.01, r.w));
  const h = Math.min(1 - y, Math.max(0.01, r.h));
  return { x, y, w, h };
}
