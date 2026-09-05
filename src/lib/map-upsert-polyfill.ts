/**
 * `Map`/`WeakMap` upsert methods (TC39 "upsert" proposal).
 *
 * pdfjs-dist 6.x calls `getOrInsertComputed` on both the main thread and inside
 * its worker. The method only landed in very recent Chrome/Firefox, so every
 * other browser (Safari, Edge, any shop or field tablet a release behind) throws
 * `getOrInsertComputed is not a function` the moment a PDF is opened — which
 * took down sheet upload, title-block mapping, and the sheet viewer.
 *
 * Call `installMapUpsertPolyfill()` before pdf.js in whatever realm pdf.js runs
 * in. The module also self-installs on import; the explicit call exists because
 * this package is marked `"sideEffects": false`, so an import-only module gets
 * tree-shaken out of the production bundle.
 */
type UpsertMap<K, V> = {
  has(key: K): boolean;
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
  getOrInsert?: (key: K, value: V) => V;
  getOrInsertComputed?: (key: K, callback: (key: K) => V) => V;
};

function install(proto: UpsertMap<unknown, unknown> | undefined) {
  if (!proto) return;
  if (typeof proto.getOrInsert !== "function") {
    Object.defineProperty(proto, "getOrInsert", {
      value: function getOrInsert(this: UpsertMap<unknown, unknown>, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
  if (typeof proto.getOrInsertComputed !== "function") {
    Object.defineProperty(proto, "getOrInsertComputed", {
      value: function getOrInsertComputed(
        this: UpsertMap<unknown, unknown>,
        key: unknown,
        callback: (key: unknown) => unknown,
      ) {
        if (this.has(key)) return this.get(key);
        if (typeof callback !== "function") {
          throw new TypeError("getOrInsertComputed: callback must be a function");
        }
        const value = callback(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }
}

export function installMapUpsertPolyfill() {
  install(Map.prototype as unknown as UpsertMap<unknown, unknown>);
  install(WeakMap.prototype as unknown as UpsertMap<unknown, unknown>);
}

// Runs on import so it is in place before any pdf.js module body evaluates.
installMapUpsertPolyfill();
