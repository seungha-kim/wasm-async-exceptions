#ifndef LEARN_ASYNCIFY_RUNTIME_HELPERS_H
#define LEARN_ASYNCIFY_RUNTIME_HELPERS_H

// Emit a console.log line from Wasm. Used to print PASS:/FAIL: signals.
void scenario_log(const char* msg);

// Suspend the current Wasm frame on a Promise controlled by the test harness.
// Defined here for shared surface; unused by S1 (target A, no suspend).
void await_controlled_promise(const char* id);

#endif