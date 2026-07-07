#include "runtime_helpers.h"
#include <stdexcept>
#include <string>

int main() {
  std::string saved;

  try {
    scenario_log("S16:before-first-suspend");
    await_controlled_promise("s16-1");
    scenario_log("S16:after-first-resume");
    throw std::runtime_error("S16");
  } catch (const std::exception& e) {
    scenario_log("PASS:s16-catch-string-copied");
    saved = e.what();
  }

  scenario_log("S16:before-second-suspend");
  // Control point: only an ordinary std::string payload crosses this suspend.
  // Observed: A/D pass cleanly; B reaches done, then reports unreachable.
  await_controlled_promise("s16-2");
  scenario_log("S16:after-second-resume");

  scenario_log("PASS:s16-string-readable");
  scenario_log(saved.c_str());
  scenario_log("PASS:s16-done");
  return 0;
}
