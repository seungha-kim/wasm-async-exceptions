# S11-S17 Exception Edge Controls Design

## Goal

Add resolution-only edge scenarios for targets A/B/D that narrow which C++
exception artifacts break when an async boundary is crossed.

The existing S9, S10, and S12 results show that Asyncify + Wasm EH can fail
when live or captured exception state survives across an Asyncify suspend.
These new scenarios separate true exception runtime state from ordinary copied
payloads and from exception state created entirely after a resume.

## Scope

Targets:

- A: Asyncify + JS exception handling
- B: Asyncify + Wasm exception handling
- D: JSPI + Wasm exception handling

Out of scope:

- C, because JSPI + JS exception handling already fails before controlled
  Promise driving is useful.
- E and E', because coroutine scenarios use a different call shape.
- Promise rejection. Every JavaScript Promise in this batch is externally
  resolved.

## Scenarios

### S11: Nested exception captured across suspend

Create a nested exception with `std::throw_with_nested`, store the active
exception as `std::exception_ptr`, suspend, then rethrow and inspect the nested
exception with `std::rethrow_if_nested`.

This extends S12 from a single captured exception to a nested captured
exception.

### S12: Captured exception_ptr across suspend

Existing scenario. It remains the baseline for `std::exception_ptr` crossing a
suspend before `std::rethrow_exception`.

### S13: Copied exception object across suspend

Catch a concrete `std::runtime_error`, copy it into a normal C++ object, leave
the catch, suspend, then read the copied object's `what()` value.

This checks whether B fails only for exception runtime state, not for ordinary
C++ objects derived from an exception payload.

### S14: Repeated normal yields before throw

Existing scenario. It remains the control for repeated resolved suspends where
no exception state is live across a suspend.

### S15: Stable what() pointer across suspend

Throw a custom exception whose `what()` points to a string literal, save only
that stable `const char*`, leave the catch, suspend, then log the pointer
payload.

This intentionally avoids dangling `what()` storage so the result is a payload
control rather than undefined behavior.

### S16: Copied what() string across suspend

Catch a C++ exception, copy `what()` into `std::string`, leave the catch,
suspend, then log the string.

This is the ordinary string-payload version of S15.

### S17: exception_ptr created after resume and rethrown before next suspend

Suspend and resume first. Only after the resume, throw and capture an
`std::exception_ptr`, then immediately rethrow it before any later suspend.

This checks whether `exception_ptr` itself is unusable in B, or whether the
failure requires the captured exception state to cross an Asyncify suspend.

## Expected Observations

- A should pass every new scenario.
- D should pass every new scenario.
- B fails S11 like S12: nested captured exception state crosses an Asyncify
  suspend and fails when reactivated.
- B passes S17: `std::exception_ptr` is created after resume and consumed
  before any later suspend.
- B reaches `PASS:done` for S13, S15, and S16, so copied payloads are readable
  after suspend. However, each of those scenarios still emits a post-done
  `[pageerror] unreachable`, so they are warning cases rather than clean
  successes.

If the actual observations differ, the snapshots and findings should preserve
the observed behavior rather than the expectation.
