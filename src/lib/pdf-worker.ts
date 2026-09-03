/**
 * pdf.js worker entry — bundled by Vite (`?worker&url`) so the polyfill runs inside
 * the worker realm before pdf.js worker code does. The worker bundle uses
 * `Map.prototype.getOrInsertComputed` just like the main-thread build.
 */
import { installMapUpsertPolyfill } from "@/lib/map-upsert-polyfill";
import "pdfjs-dist/build/pdf.worker.min.mjs";

installMapUpsertPolyfill();
