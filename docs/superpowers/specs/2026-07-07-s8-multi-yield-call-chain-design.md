# S8 Multi-Yield Call Chain Design

## Goal

Add one resolution-only stress scenario that checks whether an outer C++
`try/catch` can catch an exception thrown from the innermost function after a
multi-level call chain has suspended and resumed at several intermediate
points.

The experiment isolates C++ exception unwinding across restored async stack
frames. It does not use JavaScript Promise rejection.

## Scope

Targets:

- A: Asyncify + JS exception handling
- B: Asyncify + Wasm exception handling
- D: JSPI + Wasm exception handling

Out of scope:

- C, because JSPI + JS exception handling already fails before the controlled
  Promise can be driven.
- E and E', because coroutine scenarios have a different control-flow shape and
  should be designed separately if needed.
- Catch-handler re-suspend after the outer catch. That belongs in a separate
  scenario if S8 leaves a follow-up question.

## Scenario Shape

The new scenario is `S8`.

The call chain has one outer `try/catch` in `main()` and three nested functions:

```cpp
main() try {
  level1();
} catch (...) {
  // expected success point
}

level1() -> await "s8-l1" -> level2()
level2() -> await "s8-l2" -> level3()
level3() -> await "s8-l3" -> throw std::runtime_error("S8")
```

Every controlled Promise is resolved by the test harness. The thrown exception
originates in C++ after the final resume.

## Success Criteria

A target passes S8 if the observed console sequence reaches:

- `S8:l1-before-suspend`
- `S8:l1-after-resume`
- `S8:l2-before-suspend`
- `S8:l2-after-resume`
- `S8:l3-before-suspend`
- `S8:l3-after-resume`
- `PASS:s8-outer-catch-reached`
- `S8`
- `PASS:s8-done`

Any page error, timeout, missed outer catch, or missing `PASS:s8-done` is a
failure for the scenario.

## Expected Observations

- A is expected to pass, based on the existing S5-S7 resolution-only stress
  results.
- B is expected to fail or expose a runtime error surface, because S5-S7 already
  show Asyncify + Wasm EH breaking when C++ exception flow crosses suspend and
  resume.
- D is expected to pass, based on the existing S5-S7 JSPI + Wasm EH results.

Post-implementation observation: B also passes S8. This narrows the B failure
surface from "any C++ throw after multiple resolved yields" to the S5-S7 shapes
where catch/unwind/rethrow exception state is live across a suspend.

## Test and Documentation Plan

Add `src/scenarios/S8.cpp`, A/B/D example wrappers and expectations, CMake
targets, and Playwright specs with snapshots. Update the matrix and findings
documentation after observing the actual outputs.

The implementation should preserve the current convention that expected
failures are still tested as stable observations.
