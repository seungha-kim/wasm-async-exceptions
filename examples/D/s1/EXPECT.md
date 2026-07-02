# D / S1 — expectation

Target D = JSPI + Wasm exception handling. Scenario S1 is the synchronous
throw/catch baseline.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`
4. `PASS:s1-done`

D should avoid C's `trying to suspend JS frames` failure because JS exception
emulation is removed.
