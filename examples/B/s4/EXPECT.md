# B / S4 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S4 = the catch
handler *itself* contains a second suspend point.

## Hypothesis under test (this row)

Wasm exception handling opcodes own the throw/catch dispatch (not per-call
flag checking), so even when Asyncify instrumentation restores the saved
frame, a throw initiated on JS side via Promise reject should propagate into
the Wasm `try`/`catch` handler, *and* a second suspend within the catch
block should resume correctly.

## Candidate outcomes

- Clean staged flow:
  `S4:before-suspend → PASS:s4-catch-reached → (text) → PASS:s4-after-second-resume → PASS:s4-done`
- First-reject still misses the catch (same as A/S4 — the emcc warning
  indicates the combination is unsupported, so it may behave the same).
- Runtime trap mid-way.

## Caveat

`emcc` warns that this combination is unsupported in `ASYNCIFY=1` mode;
target B's result is itself the data point for "Asyncify Wasm EH mix
status as of emsdk 6.0.1".