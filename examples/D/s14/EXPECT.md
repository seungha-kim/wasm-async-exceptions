# D / S14 — expectation

Target D = JSPI + Wasm exception handling. S14 performs four normal
resolve-only suspend/resume steps, then throws from C++ and expects the outer
catch to observe it.

## Observed result

D reaches `PASS:s14-outer-catch-reached` and `PASS:s14-done`.
