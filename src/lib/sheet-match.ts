/** Match uploaded filenames to drawing sheet numbers. */

/** Strip extension and normalize. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

/**
 * Extract a likely sheet number from a filename.
 * e.g. "S-101.pdf", "job_S-201_revB.pdf", "erection_E101.png"
 */
export function guessSheetNumber(fileName: string): string | null {
  const base = baseName(fileName);
  // `_` is a "word" char in JS regex, so avoid \b — use explicit separators.
  const sep = String.raw`(?:^|[^A-Za-z0-9])`;
  const end = String.raw`(?=$|[^A-Za-z0-9])`;
  const patterns = [
    new RegExp(`${sep}([A-Za-z]{1,3}-\\d{2,4}[A-Za-z]?)${end}`),
    new RegExp(`${sep}([A-Za-z]{1,3}_\\d{2,4}[A-Za-z]?)${end}`),
    new RegExp(`${sep}([A-Za-z]\\d{2,4}[A-Za-z]?)${end}`),
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m?.[1]) return m[1].replace(/_/g, "-").toUpperCase();
  }
  if (/^[A-Za-z]{1,3}-?\d{2,4}[A-Za-z]?$/.test(base)) {
    return base.replace(/_/g, "-").toUpperCase();
  }
  return null;
}

export function normalizeSheetNo(n: string): string {
  return n.trim().toUpperCase().replace(/_/g, "-");
}

export function matchDrawingByFileName<T extends { id: string; number: string }>(
  drawings: T[],
  fileName: string,
): T | null {
  const guessed = guessSheetNumber(fileName);
  if (!guessed) return null;
  const g = normalizeSheetNo(guessed);
  const exact = drawings.find((d) => normalizeSheetNo(d.number) === g);
  if (exact) return exact;
  const g2 = g.replace(/-/g, "");
  return (
    drawings.find((d) => normalizeSheetNo(d.number).replace(/-/g, "") === g2) ??
    null
  );
}
