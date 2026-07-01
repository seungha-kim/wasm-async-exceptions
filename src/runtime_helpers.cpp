#include "runtime_helpers.h"
#include <emscripten.h>
#include <cstring>

EM_JS(void, js_log, (const char* ptr, int len), {
  const bytes = new Uint8Array(HEAP8.buffer, ptr, len);
  const msg = new TextDecoder().decode(bytes);
  console.log(msg);
});

EM_JS(void, js_await_controlled_promise, (const char* ptr, int len), {
  const id = new TextDecoder().decode(new Uint8Array(HEAP8.buffer, ptr, len));
  // The Promise returned (or resolved value) need not be awaited here in S1;
  // suspend scenarios wire this to Asyncify instead. Keep the no-op shape.
  Module.__controlledRegister && Module.__controlledRegister(id);
});

void scenario_log(const char* msg) {
  js_log(msg, static_cast<int>(std::strlen(msg)));
}

void await_controlled_promise(const char* id) {
  js_await_controlled_promise(id, static_cast<int>(std::strlen(id)));
}