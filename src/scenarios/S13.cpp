#include "runtime_helpers.h"
#include <memory>
#include <stdexcept>

int main() {
  std::unique_ptr<std::runtime_error> saved;

  try {
    scenario_log("S13:before-first-suspend");
    await_controlled_promise("s13-1");
    scenario_log("S13:after-first-resume");
    throw std::runtime_error("S13");
  } catch (const std::runtime_error& e) {
    scenario_log("PASS:s13-catch-copied");
    saved = std::make_unique<std::runtime_error>(e);
  }

  scenario_log("S13:before-second-suspend");
  // Control point: only a copied C++ exception object crosses this suspend,
  // not active or captured exception runtime state.
  // Observed: A/D pass cleanly; B reaches done, then reports unreachable.
  await_controlled_promise("s13-2");
  scenario_log("S13:after-second-resume");

  if (saved) {
    scenario_log("PASS:s13-copied-object-readable");
    scenario_log(saved->what());
  }
  scenario_log("PASS:s13-done");
  return 0;
}
