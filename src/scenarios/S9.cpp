#include "runtime_helpers.h"
#include <stdexcept>

namespace {

void helper2() {
  scenario_log("S9:helper-before-suspend");
  await_controlled_promise("s9-helper");
  scenario_log("PASS:s9-helper-after-resume");
}

void helper1() {
  scenario_log("S9:helper1-enter");
  helper2();
  scenario_log("S9:helper1-exit");
}

}  // namespace

int main() {
  try {
    scenario_log("S9:before-first-suspend");
    await_controlled_promise("s9-1");
    scenario_log("S9:after-first-resume");
    throw std::runtime_error("S9");
  } catch (const std::exception& e) {
    scenario_log("PASS:s9-catch-reached");
    scenario_log(e.what());
    // Key stress point: catch state is live in this frame while a helper
    // deeper in the call chain suspends and resumes.
    // Observed: A/D pass; B fails after helper resume.
    helper1();
    scenario_log("PASS:s9-after-helper");
  }
  scenario_log("PASS:s9-done");
  return 0;
}
