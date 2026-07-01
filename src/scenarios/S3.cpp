#include "runtime_helpers.h"
#include <stdexcept>

int main() {
  try {
    scenario_log("S3:before-suspend");
    await_controlled_promise("s3-1");
    // If control returns here it means the rejected Promise was NOT propagated
    // as a throw on resume — itself an observation worth logging.
    scenario_log("FAIL:s3-after-resume-non-throw");
  } catch (const std::exception& e) {
    scenario_log("PASS:s3-catch-reached");
    scenario_log(e.what());
  } catch (...) {
    scenario_log("PASS:s3-catch-reached-ellipsis");
  }
  scenario_log("PASS:s3-done");
  return 0;
}