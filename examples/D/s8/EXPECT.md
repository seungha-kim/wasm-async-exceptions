# D / S8 — expectation

Target D = JSPI + Wasm exception handling. Scenario S8 resolves three
controlled Promises across a nested call chain, then throws from the innermost
C++ function and expects the outer `main()` catch to observe it.

## Hypothesis under test

This is the standard-path comparison point for A/B S8. It checks whether JSPI
plus Wasm EH preserves a multi-yield call chain well enough for the innermost
C++ throw to reach the outer catch.

## Observed result

D reaches `PASS:s8-outer-catch-reached` and `PASS:s8-done`.
