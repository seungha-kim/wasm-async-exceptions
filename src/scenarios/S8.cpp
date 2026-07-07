#include "runtime_helpers.h"
#include <stdexcept>

namespace {

void level3() {
  scenario_log("S8:l3-before-suspend");
  await_controlled_promise("s8-l3");
  scenario_log("S8:l3-after-resume");
  throw std::runtime_error("S8");
}

void level2() {
  scenario_log("S8:l2-before-suspend");
  await_controlled_promise("s8-l2");
  scenario_log("S8:l2-after-resume");
  level3();
}

void level1() {
  scenario_log("S8:l1-before-suspend");
  await_controlled_promise("s8-l1");
  scenario_log("S8:l1-after-resume");
  level2();
}

}  // namespace

int main() {
  try {
    level1();
  } catch (const std::exception& e) {
    scenario_log("PASS:s8-outer-catch-reached");
    scenario_log(e.what());
  }
  scenario_log("PASS:s8-done");
  return 0;
}
