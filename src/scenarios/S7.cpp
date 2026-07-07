#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    try {
      scenario_log("S7:before-first-suspend");
      await_controlled_promise("s7-1");
      scenario_log("S7:after-first-resume");
      throw std::runtime_error("S7");
    } catch (const std::exception& e) {
      scenario_log("S7:inner-catch");
      scenario_log(e.what());
      await_controlled_promise("s7-2");
      scenario_log("S7:after-inner-resume");
      throw;
    }
  } catch (const std::exception& e) {
    scenario_log("PASS:s7-outer-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s7-done");
  return 0;
}
