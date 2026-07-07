# B / S14 — expectation

Target B = Asyncify + Wasm exception handling. S14 performs four normal
resolve-only suspend/resume steps, then throws from C++ and expects the outer
catch to observe it.

## Observed result

B reaches `PASS:s14-outer-catch-reached` and `PASS:s14-done`.

This reinforces S8: repeated normal frame restoration followed by a later C++
throw is not enough to break B. The failing cases require live or captured
Wasm EH exception state to cross the suspend boundary.
