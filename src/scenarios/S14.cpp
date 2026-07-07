#include "runtime_helpers.h"
#include <stdexcept>

namespace {

void repeated_suspends() {
  // Control case: repeated normal suspend/resume points, followed by a C++
  // throw only after all resumes complete. Observed: A/B/D pass.
  scenario_log("S14:before-suspend-1");
  await_controlled_promise("s14-1");
  scenario_log("S14:after-resume-1");

  scenario_log("S14:before-suspend-2");
  await_controlled_promise("s14-2");
  scenario_log("S14:after-resume-2");

  scenario_log("S14:before-suspend-3");
  await_controlled_promise("s14-3");
  scenario_log("S14:after-resume-3");

  scenario_log("S14:before-suspend-4");
  await_controlled_promise("s14-4");
  scenario_log("S14:after-resume-4");

  throw std::runtime_error("S14");
}

}  // namespace

int main() {
  try {
    repeated_suspends();
  } catch (const std::exception& e) {
    scenario_log("PASS:s14-outer-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s14-done");
  return 0;
}
