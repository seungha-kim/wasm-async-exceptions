(function () {
  'use strict';

  const pending = new Map();

  window.__Coro = {
    register(id, handle) {
      pending.set(id, { handle });
    },
    resolve(id) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending coroutine await: ' + id);
      pending.delete(id);
      window.__WasmModule._coro_settle(entry.handle, 0);
      window.__WasmModule._coro_resume(entry.handle);
    },
    reject(id) {
      const entry = pending.get(id);
      if (!entry) throw new Error('no pending coroutine await: ' + id);
      pending.delete(id);
      window.__WasmModule._coro_settle(entry.handle, 1);
      window.__WasmModule._coro_resume(entry.handle);
    },
  };
})();
