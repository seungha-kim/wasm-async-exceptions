#include "runtime_helpers.h"
#include <exception>

namespace {

class StaticWhatException : public std::exception {
 public:
  const char* what() const noexcept override {
    return "S15";
  }
};

}  // namespace

int main() {
  const char* saved = nullptr;

  try {
    scenario_log("S15:before-first-suspend");
    await_controlled_promise("s15-1");
    scenario_log("S15:after-first-resume");
    throw StaticWhatException();
  } catch (const std::exception& e) {
    scenario_log("PASS:s15-catch-pointer-stored");
    saved = e.what();
  }

  scenario_log("S15:before-second-suspend");
  // Control point: saved points to a stable string literal, so this does not
  // depend on exception object lifetime after the catch exits.
  // Observed: A/D pass cleanly; B reaches done, then reports unreachable.
  await_controlled_promise("s15-2");
  scenario_log("S15:after-second-resume");

  scenario_log("PASS:s15-pointer-readable");
  scenario_log(saved);
  scenario_log("PASS:s15-done");
  return 0;
}
