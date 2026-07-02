# C / S4 — expectation

Target C = JSPI + JS exception emulation. Scenario S4 = the catch handler
*itself* contains a second suspend point.

## Hypothesis under test (this row)

JSPI keeps the suspended Wasm frame *live* (stack switched, not buffered),
so the first reject should deliver into the catch handler, and the catch
handler's second `await_controlled_promise("s4-2")` become a genuine second
stack-switch suspend rather than a recursive save-buffer dance. **This is
the first row where §1.2 conflict #2 ("catch 복귀 지점의 비대칭") becomes
directly probe-able**: target A collapsed before reaching the catch, target
B's combination is unsupported according to emcc, so target C is where the
catch+resuspend flow has its first fair chance.

## Candidate outcomes

- **Clean staged flow**:
  `S4:before-suspend → PASS:s4-catch-reached → (S4 text) → PASS:s4-after-second-resume → PASS:s4-done`
- **First catch hit, second suspend breaks**: catch fires, but the second
  `await_controlled_promise` traps or produces `FAIL:s4-after-second-resume`
  via pageerror.
- **First catch missed**: same as A/S4 (no catch entry, s4-2 never
  registered).