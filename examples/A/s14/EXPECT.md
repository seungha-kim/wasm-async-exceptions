# A / S14 — expectation

Target A = Asyncify + JS exception emulation. S14 performs four normal
resolve-only suspend/resume steps, then throws from C++ and expects the outer
catch to observe it.

## Observed result

A reaches `PASS:s14-outer-catch-reached` and `PASS:s14-done`.
