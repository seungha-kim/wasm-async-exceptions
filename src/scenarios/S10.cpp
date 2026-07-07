#include "runtime_helpers.h"
#include <stdexcept>

namespace {

void cleanup_helper2() {
  scenario_log("S10:helper-before-suspend");
  await_controlled_promise("s10-cleanup");
  scenario_log("PASS:s10-helper-after-resume");
}

void cleanup_helper1() {
  scenario_log("S10:helper1-enter");
  cleanup_helper2();
  scenario_log("S10:helper1-exit");
}

struct Cleanup {
  ~Cleanup() {
    scenario_log("S10:dtor-enter");
    // Key stress point: exception unwinding is live while a helper called by
    // this destructor suspends and resumes.
    // Observed: A/D pass; B fails after helper resume.
    cleanup_helper1();
    scenario_log("PASS:s10-dtor-after-helper");
  }
};

}  // namespace

int main() {
  try {
    Cleanup cleanup;
    scenario_log("S10:before-work-suspend");
    await_controlled_promise("s10-work");
    scenario_log("S10:after-work-resume");
    throw std::runtime_error("S10");
  } catch (const std::exception& e) {
    scenario_log("PASS:s10-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s10-done");
  return 0;
}
