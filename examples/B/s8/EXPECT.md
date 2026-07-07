# B / S8 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S8 resolves three
controlled Promises across a nested call chain, then throws from the innermost
C++ function and expects the outer `main()` catch to observe it.

## Hypothesis under test

This is a narrower resolution-only stress case than S5-S7. It checks whether
B fails merely because a C++ throw follows multiple suspend/resume points, or
only when suspend happens while exception state is already active.

## Observed result

B reaches `PASS:s8-outer-catch-reached` and `PASS:s8-done`. This contrasts with
B/S5-S7: Asyncify + Wasm EH does not fail every C++ throw-after-yield shape,
but it does fail the catch/unwind/rethrow stress cases where exception state is
live across a suspend.
