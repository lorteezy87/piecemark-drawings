/** Match uploaded filenames to drawing sheet numbers (real fab shop names). */

/** Strip extension and normalize. */
export function baseName(fileName: string): string {
  const just = fileName.split(/[/\\]/).pop() || fileName;
  return just.replace(/\.[^.]+$/, "").trim();
}

export function normalizeSheetNo(n: string): string {
  return n
    .trim()
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "")
    .replace(/\.+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Extract candidate sheet numbers from a filename (most specific first).
 * Handles: S-101, S_101, S101, S.101, E 101, job_SE-24_E-201_revB, etc.
 */
export function guessSheetCandidates(fileName: string): string[] {
  const base = baseName(fileName);
  const upper = base.toUpperCase();
  const found: string[] = [];
  const push = (raw: string) => {
    const n = normalizeSheetNo(raw);
    if (n && !found.includes(n)) found.push(n);
  };

  const reLoose =
    /(?:^|[^A-Z0-9])([A-Z]{1,3})[\s._\-–—]*(\d{1,4})([A-Z]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = reLoose.exec(upper)) !== null) {
    push(`${m[1]}-${m[2]}${m[3] || ""}`);
  }

  const reCompact =
    /(?:^|[^A-Z0-9])([A-Z]{1,3})(\d{2,4})([A-Z]?)(?=$|[^A-Z0-9])/gi;
  while ((m = reCompact.exec(upper)) !== null) {
    push(`${m[1]}-${m[2]}${m[3] || ""}`);
  }

  if (/^[A-Z]{1,3}[\s._\-–—]?\d{1,4}[A-Z]?$/i.test(base)) {
    push(base);
  }

  found.sort((a, b) => b.length - a.length);
  return found;
}

export function guessSheetNumber(fileName: string): string | null {
  return guessSheetCandidates(fileName)[0] ?? null;
}

export type MatchOpts = {
  /**
   * When true: only exact/near-exact sheet-number token matches.
   * No title fuzzy matching. Use for bulk multi-file so files don't collapse.
   */
  strict?: boolean;
};

/**
 * Match a file to a drawing in the pool.
 */
export function matchDrawingByFileName<
  T extends { id: string; number: string; title?: string },
>(drawings: T[], fileName: string, opts?: MatchOpts): T | null {
  if (!drawings.length) return null;
  const base = baseName(fileName);
  const baseNorm = normalizeSheetNo(base);
  const baseLoose = base.toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  const strict = opts?.strict === true;

  const byNorm = new Map(
    drawings.map((d) => [normalizeSheetNo(d.number), d] as const),
  );

  // 1) Candidates from filename → exact register hit
  for (const c of guessSheetCandidates(fileName)) {
    const hit = byNorm.get(c);
    if (hit) return hit;
    for (const [k, d] of byNorm) {
      if (k.replace(/-/g, "") === c.replace(/-/g, "")) return d;
    }
  }

  if (strict) return null;

  // 2) Drawing number contained in filename (longest first)
  const sorted = [...drawings].sort(
    (a, b) =>
      normalizeSheetNo(b.number).length - normalizeSheetNo(a.number).length,
  );
  for (const d of sorted) {
    const n = normalizeSheetNo(d.number);
    const compact = n.replace(/-/g, "");
    if (compact.length < 3) continue; // avoid tiny false positives
    if (baseNorm.includes(n) || baseNorm.includes(compact)) return d;
    const spaced = n.replace("-", " ");
    if (baseLoose.includes(spaced) || baseLoose.includes(compact)) return d;
  }

  // 3) Title phrase
  for (const d of drawings) {
    if (!d.title) continue;
    const words = d.title
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 3 && !STOP.has(w));
    if (words.length < 2) continue;
    const hitCount = words.filter((w) => baseLoose.includes(w)).length;
    if (hitCount >= Math.min(3, words.length) && hitCount >= 2) return d;
  }

  return null;
}

const STOP = new Set([
  "PLAN",
  "ELEVATION",
  "SECTION",
  "DETAIL",
  "DETAILS",
  "SHEET",
  "DRAWING",
  "REV",
  "REVISION",
  "STEEL",
  "LEVEL",
  "FLOOR",
  "ROOF",
  "AND",
  "THE",
  "FOR",
]);

/** Suggest a sheet number for creating a new register row from a file. */
export function suggestNumberFromFile(
  fileName: string,
  used: Set<string>,
): string {
  const guess = guessSheetNumber(fileName);
  if (guess && !used.has(normalizeSheetNo(guess))) return guess;
  const base = baseName(fileName)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .toUpperCase();
  let candidate = base || "SHEET";
  let i = 1;
  while (used.has(normalizeSheetNo(candidate))) {
    candidate = `${base || "SHEET"}-${i++}`;
  }
  return candidate;
}
