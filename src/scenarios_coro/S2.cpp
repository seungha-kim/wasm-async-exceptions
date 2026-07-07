#include "coro_glue.h"
#include <stdexcept>

ScenarioTask scenario() {
  try {
    scenario_log("S2:before-suspend");
    // Resolve-only coroutine suspend, followed by a C++-initiated throw.
    // Observed: E and E' pass.
    co_await await_controlled_promise("s2-1");
    scenario_log("S2:after-resume");
    throw std::runtime_error("S2");
    scenario_log("FAIL:s2-after-throw-unreachable");
  } catch (const std::exception& e) {
    scenario_log("PASS:s2-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s2-done");
}

int main() {
  auto task = scenario();
  task.start();
  return 0;
}
