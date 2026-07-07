#include "runtime_helpers.h"
#include <exception>
#include <stdexcept>

int main() {
  std::exception_ptr saved;

  try {
    scenario_log("S12:before-first-suspend");
    await_controlled_promise("s12-1");
    scenario_log("S12:after-first-resume");
    throw std::runtime_error("S12");
  } catch (...) {
    scenario_log("PASS:s12-catch-stored");
    saved = std::current_exception();
  }

  scenario_log("S12:before-second-suspend");
  // Key stress point: the catch has ended, but an exception_ptr captured from
  // Wasm EH state is kept across this suspend and rethrown afterwards.
  // Observed: A/D pass; B fails when rethrow_exception is attempted.
  await_controlled_promise("s12-2");
  scenario_log("S12:after-second-resume");

  try {
    std::rethrow_exception(saved);
  } catch (const std::exception& e) {
    scenario_log("PASS:s12-rethrow-catch-reached");
    scenario_log(e.what());
  }

  scenario_log("PASS:s12-done");
  return 0;
}
