# D / S2 — expectation

Target D = JSPI + Wasm exception handling. Scenario S2 resolves a controlled
Promise, resumes Wasm, then throws from C++ code.

## Expected observation

Console (in order):
1. `S2:before-suspend`
2. `S2:after-resume`
3. `PASS:s2-catch-reached`
4. `S2`
5. `PASS:s2-done`

D should preserve A/B's happy S2 path while avoiding C's JSPI+JS-EH failure.
