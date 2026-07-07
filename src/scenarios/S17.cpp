#include "runtime_helpers.h"
#include <exception>
#include <stdexcept>

int main() {
  scenario_log("S17:before-suspend");
  await_controlled_promise("s17-1");
  scenario_log("S17:after-resume");

  std::exception_ptr saved;
  try {
    throw std::runtime_error("S17");
  } catch (...) {
    scenario_log("PASS:s17-catch-stored");
    saved = std::current_exception();
  }

  // Control point: exception_ptr is created after the resume and consumed
  // before any later suspend, so it never crosses an async boundary.
  // Observed: A/B/D pass.
  try {
    std::rethrow_exception(saved);
  } catch (const std::exception& e) {
    scenario_log("PASS:s17-rethrow-catch-reached");
    scenario_log(e.what());
  }

  scenario_log("PASS:s17-done");
  return 0;
}
