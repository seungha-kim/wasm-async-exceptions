#include "runtime_helpers.h"
#include <emscripten.h>
#include <cstring>

EM_JS(void, js_log, (const char* ptr, int len), {
  const bytes = new Uint8Array(HEAP8.buffer, ptr, len);
  const msg = new TextDecoder().decode(bytes);
  console.log(msg);
});

// Asyncify-aware await: returns (well, awaits) a Promise from the harness.
// Emscripten lists the generated JS symbol `jsAwaitControlledPromise` as an
// ASYNCIFY_IMPORTS entry, so the stack-save/restore instrumentation kicks in
// whenever this import is invoked from Wasm.
EM_ASYNC_JS(void, js_await_controlled_promise, (const char* ptr, int len), {
  const id = new TextDecoder().decode(new Uint8Array(HEAP8.buffer, ptr, len));
  await window.__Controlled.register(id);
});

void scenario_log(const char* msg) {
  js_log(msg, static_cast<int>(std::strlen(msg)));
}

void await_controlled_promise(const char* id) {
  js_await_controlled_promise(id, static_cast<int>(std::strlen(id)));
}