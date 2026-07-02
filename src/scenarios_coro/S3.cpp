#include "coro_glue.h"
#include <stdexcept>

ScenarioTask scenario() {
  try {
    scenario_log("S3:before-suspend");
    co_await await_controlled_promise("s3-1");
    scenario_log("FAIL:s3-after-resume-non-throw");
  } catch (const std::exception& e) {
    scenario_log("PASS:s3-catch-reached");
    scenario_log(e.what());
  } catch (...) {
    scenario_log("PASS:s3-catch-reached-ellipsis");
  }
  scenario_log("PASS:s3-done");
}

int main() {
  auto task = scenario();
  task.start();
  return 0;
}
