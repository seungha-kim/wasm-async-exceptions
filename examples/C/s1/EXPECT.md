# C / S1 — expectation

Target C = JSPI + JS exception emulation. Scenario S1 is the synchronous
throw/catch baseline (no suspend) — used to confirm the JSPI flag compiles
and runs on its own.

## Expected observation

Console (in order):
1. `S1:before-throw`
2. `PASS:s1-catch-reached`
3. `S1`
4. `PASS:s1-done`

Same as A/S1 and B/S1 — JSPI should make no observable difference when no
suspend is involved.