# C / S2 — expectation

Target C = JSPI + JS exception emulation. Scenario S2 = suspend on a
controlled Promise, then after resume throw inside main's try block.

## Hypothesis under test (this row)

JSPI switches stack-switching from binary instrumentation to the Wasm
runtime itself (no save/restore buffer), but JS exception emulation still
uses per-call flag propagation. For S2 (throw initiated *after* resume via
C++ `throw`), we expect no change from A/S2: the resume completes, C++
throws, the per-call flag propagates back through Wasm's normal return
path, and `main`'s catch fires.

## Happy path (expected)

1. `S2:before-suspend`
2. `S2:after-resume`
3. `PASS:s2-catch-reached`
4. `S2`
5. `PASS:s2-done`