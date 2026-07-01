#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S4:before-suspend");
    await_controlled_promise("s4-1");           // will be rejected
    scenario_log("FAIL:s4-after-resume-not-thrown");
  } catch (const std::exception& e) {
    scenario_log("PASS:s4-catch-reached");
    scenario_log(e.what());
    // Re-suspend from inside the catch handler — does Asyncify's state
    // machine tolerate a second suspend-point share the same catch frame?
    await_controlled_promise("s4-2");
    scenario_log("PASS:s4-after-second-resume");
  }
  scenario_log("PASS:s4-done");
  return 0;
}