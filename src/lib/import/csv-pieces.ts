/** Parse simple CSV of piece marks for bulk sheet creation / mark attach. */

export type PieceCsvRow = {
  mark: string;
  drawingNumber?: string;
  title?: string;
  setCode?: string;
  tonnage?: number;
};

/** Accepts header row: mark,drawing,title,set,tonnage (flexible names). */
export function parsePieceCsv(text: string): PieceCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (c === '"') {
        q = !q;
        continue;
      }
      if (c === "," && !q) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const header = split(lines[0]!).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) =>
    ["mark", "piece", "piecemark", "member"].includes(h),
  );
  const start = hasHeader ? 1 : 0;
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iMark = hasHeader ? idx(["mark", "piece", "piecemark", "member"]) : 0;
  const iDwg = hasHeader ? idx(["drawing", "drawingnumber", "sheet", "dwg"]) : 1;
  const iTitle = hasHeader ? idx(["title", "description"]) : 2;
  const iSet = hasHeader ? idx(["set", "setcode", "package"]) : 3;
  const iTons = hasHeader ? idx(["tonnage", "tons", "ton"]) : 4;

  const rows: PieceCsvRow[] = [];
  for (let li = start; li < lines.length; li++) {
    const cols = split(lines[li]!);
    const mark = (cols[iMark] ?? "").trim();
    if (!mark || mark.toLowerCase() === "mark") continue;
    const tonRaw = iTons >= 0 ? cols[iTons] : undefined;
    rows.push({
      mark,
      drawingNumber: iDwg >= 0 ? cols[iDwg] || undefined : undefined,
      title: iTitle >= 0 ? cols[iTitle] || undefined : undefined,
      setCode: iSet >= 0 ? cols[iSet] || undefined : undefined,
      tonnage: tonRaw ? Number(tonRaw) : undefined,
    });
  }
  return rows;
}
