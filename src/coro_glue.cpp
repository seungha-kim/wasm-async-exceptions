#include "coro_glue.h"

#include <emscripten.h>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <unordered_map>

namespace {

std::unordered_map<std::uintptr_t, int> g_resume_status;

EM_JS(void, js_log, (const char* ptr, int len), {
  const bytes = new Uint8Array(HEAP8.buffer, ptr, len);
  const msg = new TextDecoder().decode(bytes);
  console.log(msg);
});

EM_JS(void, js_register_coroutine_await, (const char* ptr, int len, std::uintptr_t handle), {
  const id = new TextDecoder().decode(new Uint8Array(HEAP8.buffer, ptr, len));
  window.__Coro.register(id, Number(handle));
});

}  // namespace

void scenario_log(const char* msg) {
  js_log(msg, static_cast<int>(std::strlen(msg)));
}

void ScenarioTask::promise_type::unhandled_exception() {
  scenario_log("FAIL:unhandled-coroutine-exception");
}

void ScenarioTask::start() {
  if (!handle_) return;
  auto handle = handle_;
  handle.resume();
  if (handle.done()) {
    handle.destroy();
    handle_ = nullptr;
  }
}

void ControlledAwaitable::Awaiter::await_suspend(std::coroutine_handle<> coroutine_handle) {
  handle = reinterpret_cast<std::uintptr_t>(coroutine_handle.address());
  js_register_coroutine_await(
    id,
    static_cast<int>(std::strlen(id)),
    handle
  );
}

void ControlledAwaitable::Awaiter::await_resume() const {
  auto it = g_resume_status.find(handle);
  if (it == g_resume_status.end()) {
    throw std::runtime_error("missing coroutine resume status");
  }
  int rejected = it->second;
  g_resume_status.erase(it);
  if (rejected) {
    throw std::runtime_error(id);
  }
}

ControlledAwaitable await_controlled_promise(const char* id) {
  return ControlledAwaitable(id);
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
void coro_settle(std::uintptr_t handle, int rejected) {
  g_resume_status[handle] = rejected;
}

EMSCRIPTEN_KEEPALIVE
void coro_resume(std::uintptr_t raw_handle) {
  auto handle = std::coroutine_handle<>::from_address(
    reinterpret_cast<void*>(raw_handle)
  );
  handle.resume();
  if (handle.done()) {
    handle.destroy();
  }
}

}
