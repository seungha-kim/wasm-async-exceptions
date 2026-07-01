// Loaded by src/page_template.html *before* the emcc-generated main.js so
// that main.js can attach EMCC imports to window.__imports when instantiating.

(function () {
  'use strict';

  /** All console.log lines observed on the page, in order. Tests read this. */
  const logLines = [];
  window.__logLines = logLines;

  const _log = console.log.bind(console);
  console.log = function (...args) {
    const line = args.map(String).join(' ');
    logLines.push(line);
    return _log(...args);
  };

  /** Registry of controlled promises keyed by scenario-controlled id. */
  const pending = new Map();
  window.__Controlled = {
    register(id) {
      const p = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      p.__id = id;
      return p;
    },
    resolve(id) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending controlled promise: ' + id);
      pending.delete(id);
      entry.resolve();
    },
    reject(id, err) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending controlled promise: ' + id);
      pending.delete(id);
      entry.reject(err);
    },
  };

  /** JS-side implementations of imports that main.js wires in. */
  // `HEAP8` is defined by Emscripten's generated main.js *after* instantiation;
  // these closures only reference HEAP8 when Wasm calls the import, by which
  // time window.HEAP8 has been set by the page template.
  window.__imports = {
    jsLog: (ptr, len) => {
      const bytes = new Uint8Array(window.HEAP8.buffer, ptr, len);
      const msg = new TextDecoder().decode(bytes);
      console.log(msg);
    },
    // await_controlled_promise(id_ptr, id_len) -- only used in suspend scenarios;
    // defined here so all targets share the import surface.
    jsAwaitControlledPromise: async (idPtr, idLen) => {
      const id = new TextDecoder().decode(new Uint8Array(window.HEAP8.buffer, idPtr, idLen));
      return window.__Controlled.register(id);
    },
  };
})();