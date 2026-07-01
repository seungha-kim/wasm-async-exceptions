#include "runtime_helpers.h"
#include <cstring>

extern "C" {
  extern void jsLog(const char* ptr, int len);
  extern void jsAwaitControlledPromise(const char* ptr, int len);
}

void scenario_log(const char* msg) {
  jsLog(msg, static_cast<int>(std::strlen(msg)));
}

void await_controlled_promise(const char* id) {
  jsAwaitControlledPromise(id, static_cast<int>(std::strlen(id)));
}