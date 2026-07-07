#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S5:before-first-suspend");
    await_controlled_promise("s5-1");
    scenario_log("S5:after-first-resume");
    throw std::runtime_error("S5");
  } catch (const std::exception& e) {
    scenario_log("PASS:s5-catch-reached");
    scenario_log(e.what());
    scenario_log("S5:catch-before-suspend");
    // Key stress point: suspend from inside a C++ catch handler.
    // Observed: A passes, B fails after resume, D passes.
    await_controlled_promise("s5-2");
    scenario_log("PASS:s5-after-catch-resume");
  }
  scenario_log("PASS:s5-done");
  return 0;
}
