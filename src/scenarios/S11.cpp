#include "runtime_helpers.h"
#include <exception>
#include <stdexcept>

int main() {
  std::exception_ptr saved;

  try {
    try {
      scenario_log("S11:before-first-suspend");
      await_controlled_promise("s11-1");
      scenario_log("S11:after-first-resume");
      throw std::runtime_error("S11-inner");
    } catch (...) {
      scenario_log("PASS:s11-inner-catch-reached");
      std::throw_with_nested(std::runtime_error("S11-outer"));
    }
  } catch (...) {
    scenario_log("PASS:s11-catch-stored");
    saved = std::current_exception();
  }

  scenario_log("S11:before-second-suspend");
  // Key stress point: the nested exception_ptr crosses this suspend.
  // Observed: A/D pass; B fails after resume with null function/unreachable.
  await_controlled_promise("s11-2");
  scenario_log("S11:after-second-resume");

  try {
    std::rethrow_exception(saved);
  } catch (const std::exception& e) {
    scenario_log("PASS:s11-outer-rethrow-catch-reached");
    scenario_log(e.what());
    try {
      std::rethrow_if_nested(e);
    } catch (const std::exception& nested) {
      scenario_log("PASS:s11-nested-catch-reached");
      scenario_log(nested.what());
    }
  }

  scenario_log("PASS:s11-done");
  return 0;
}
