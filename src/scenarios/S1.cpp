#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S1:before-throw");
    throw std::runtime_error("S1");
    scenario_log("FAIL:s1-after-throw-unreachable");
  } catch (const std::exception& e) {
    scenario_log("PASS:s1-catch-reached");
    scenario_log(e.what());  // prints "S1"
  }
  scenario_log("PASS:s1-done");
  return 0;
}