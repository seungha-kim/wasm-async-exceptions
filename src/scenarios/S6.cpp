#include "runtime_helpers.h"
#include <stdexcept>

namespace {

struct CleanupSuspend {
  ~CleanupSuspend() {
    scenario_log("S6:dtor-before-suspend");
    // Key stress point: suspend while C++ exception unwinding is running
    // this destructor. Observed: A passes, B fails after resume, D passes.
    await_controlled_promise("s6-cleanup");
    scenario_log("PASS:s6-dtor-after-resume");
  }
};

}  // namespace

int main() {
  try {
    CleanupSuspend cleanup;
    scenario_log("S6:before-work-suspend");
    await_controlled_promise("s6-work");
    scenario_log("S6:after-work-resume");
    throw std::runtime_error("S6");
  } catch (const std::exception& e) {
    scenario_log("PASS:s6-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s6-done");
  return 0;
}
