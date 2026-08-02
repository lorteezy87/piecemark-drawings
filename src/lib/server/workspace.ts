import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { JobPackage } from "@/lib/job-package";

export type WorkspacePull = {
  package: JobPackage | null;
  revision: number;
  updatedAt: string | null;
};

export const pullWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WorkspacePull> => {
    const sql = await getSql();
    const rows = await sql.query<{
      package_json: JobPackage | string;
      revision: number;
      updated_at: string;
    }>(
      `SELECT package_json, revision, updated_at FROM pm_workspace WHERE user_id = $1`,
      [context.userId],
    );
    const row = rows[0];
    if (!row) return { package: null, revision: 0, updatedAt: null };
    const pkg =
      typeof row.package_json === "string"
        ? (JSON.parse(row.package_json) as JobPackage)
        : row.package_json;
    return {
      package: pkg,
      revision: Number(row.revision) || 0,
      updatedAt: row.updated_at ?? null,
    };
  });

export const pushWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Invalid body");
    const o = data as {
      package?: JobPackage;
      baseRevision?: number;
      force?: boolean;
    };
    if (!o.package || o.package.app !== "piecemark") {
      throw new Error("Invalid PieceMark package");
    }
    return {
      package: o.package,
      baseRevision: typeof o.baseRevision === "number" ? o.baseRevision : 0,
      force: o.force === true,
    };
  })
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const existing = await sql.query<{
      revision: number;
      package_json: JobPackage | string;
    }>(
      `SELECT revision, package_json FROM pm_workspace WHERE user_id = $1`,
      [context.userId],
    );
    const current = existing[0]?.revision ?? 0;

    // Optimistic concurrency: reject stale push unless force
    if (current > 0 && data.baseRevision < current && !data.force) {
      const raw = existing[0]?.package_json;
      const remotePkg =
        typeof raw === "string"
          ? (JSON.parse(raw) as JobPackage)
          : (raw as JobPackage | undefined) ?? null;
      return {
        revision: current,
        conflict: true,
        serverRevisionBefore: current,
        package: remotePkg,
        accepted: false as const,
      };
    }

    const nextRev = current + 1;
    const json = JSON.stringify(data.package);
    await sql.query(
      `INSERT INTO pm_workspace (user_id, package_json, updated_at, revision)
       VALUES ($1, $2::jsonb, now(), $3)
       ON CONFLICT (user_id) DO UPDATE SET
         package_json = EXCLUDED.package_json,
         updated_at = now(),
         revision = $3`,
      [context.userId, json, nextRev],
    );

    // Mirror project index; prune jobs removed from package
    const keepIds = data.package.projects.map((p) => p.id);
    for (const p of data.package.projects) {
      await sql.query(
        `INSERT INTO pm_project (id, user_id, job_number, name, data, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           job_number = EXCLUDED.job_number,
           name = EXCLUDED.name,
           data = EXCLUDED.data,
           updated_at = now()
         WHERE pm_project.user_id = $2`,
        [p.id, context.userId, p.jobNumber, p.name, JSON.stringify(p)],
      );
    }
    if (keepIds.length === 0) {
      await sql.query(`DELETE FROM pm_project WHERE user_id = $1`, [
        context.userId,
      ]);
    } else {
      await sql.query(
        `DELETE FROM pm_project
         WHERE user_id = $1
           AND NOT (id = ANY($2::text[]))`,
        [context.userId, keepIds],
      );
    }

    return {
      revision: nextRev,
      conflict: data.baseRevision > 0 && data.baseRevision < current,
      serverRevisionBefore: current,
      accepted: true as const,
    };
  });

export const saveDrawingFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Invalid body");
    const o = data as {
      id?: string;
      drawingId?: string;
      name?: string;
      mime?: string;
      contentB64?: string;
      kind?: string;
    };
    if (!o.id || !o.name || !o.mime || !o.contentB64) {
      throw new Error("id, name, mime, contentB64 required");
    }
    // Cap ~8MB base64 (~6MB binary) for DB storage without object store
    if (o.contentB64.length > 11_000_000) {
      throw new Error("File too large for server store (max ~6MB). Use local IDB only.");
    }
    return {
      id: o.id,
      drawingId: o.drawingId ?? null,
      name: o.name,
      mime: o.mime,
      contentB64: o.contentB64,
      kind: o.kind ?? "sheet",
    };
  })
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const size = Math.floor((data.contentB64.length * 3) / 4);
    await sql.query(
      `INSERT INTO pm_file (id, user_id, drawing_id, kind, name, mime, size_bytes, content_b64, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         mime = EXCLUDED.mime,
         size_bytes = EXCLUDED.size_bytes,
         content_b64 = EXCLUDED.content_b64,
         drawing_id = EXCLUDED.drawing_id
       WHERE pm_file.user_id = $2`,
      [
        data.id,
        context.userId,
        data.drawingId,
        data.kind,
        data.name,
        data.mime,
        size,
        data.contentB64,
      ],
    );
    return { ok: true as const, size };
  });

export const listDrawingFiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql.query<{
      id: string;
      drawing_id: string | null;
      kind: string;
      name: string;
      mime: string;
      size_bytes: number;
      created_at: string;
    }>(
      `SELECT id, drawing_id, kind, name, mime, size_bytes, created_at
       FROM pm_file WHERE user_id = $1 ORDER BY created_at DESC`,
      [context.userId],
    );
  });

export const getDrawingFile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: unknown) => {
    const id =
      typeof data === "string"
        ? data
        : data && typeof data === "object" && "id" in data
          ? String((data as { id: string }).id)
          : "";
    if (!id) throw new Error("id required");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      drawing_id: string | null;
      name: string;
      mime: string;
      content_b64: string | null;
    }>(
      `SELECT id, drawing_id, name, mime, content_b64 FROM pm_file
       WHERE id = $1 AND user_id = $2`,
      [data.id, context.userId],
    );
    return rows[0] ?? null;
  });
