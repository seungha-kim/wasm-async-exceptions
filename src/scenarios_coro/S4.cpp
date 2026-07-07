#include "coro_glue.h"
#include <stdexcept>

ScenarioTask scenario() {
  bool caught = false;
  try {
    scenario_log("S4:before-suspend");
    // Rejected settlement is converted to C++ throw in await_resume().
    // Observed: E and E' enter this catch.
    co_await await_controlled_promise("s4-1");
    scenario_log("FAIL:s4-after-resume-not-thrown");
  } catch (const std::exception& e) {
    caught = true;
    scenario_log("PASS:s4-catch-reached");
    scenario_log(e.what());
  }
  if (caught) {
    scenario_log("S4:before-second-suspend");
    // Standard C++ disallows co_await directly inside catch, so the second
    // suspend is immediately after catch in the same coroutine. E/E' pass.
    co_await await_controlled_promise("s4-2");
    scenario_log("PASS:s4-after-second-resume");
  }
  scenario_log("PASS:s4-done");
}

int main() {
  auto task = scenario();
  task.start();
  return 0;
}
