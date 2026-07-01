#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S2:before-suspend");
    await_controlled_promise("s2-1");
    scenario_log("S2:after-resume");          // only printed if resume succeeded
    throw std::runtime_error("S2");
    scenario_log("FAIL:s2-after-throw-unreachable");
  } catch (const std::exception& e) {
    scenario_log("PASS:s2-catch-reached");
    scenario_log(e.what());                    // prints "S2"
  }
  scenario_log("PASS:s2-done");
  return 0;
}