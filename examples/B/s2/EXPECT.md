# B / S2 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S2 = suspend on a
controlled Promise, then after resume throw inside main's try block.

## Hypothesis under test (this row)

Wasm exception handling opcodes own the throw/catch dispatch (not per-call
flag checking), so even when Asyncify instrumentation restores the saved
frame, a throw initiated by **C++ code after resume** should propagate into
the Wasm `try`/`catch` handler.

## If no conflict manifests (happy path)

Console (in order):
1. `S2:before-suspend`
2. `S2:after-resume`
3. `PASS:s2-catch-reached`
4. `S2`
5. `PASS:s2-done`

## Caveat flagged at build time

`emcc` emits a warning that `ASYNCIFY=1` is "not compatible with
`-fwasm-exceptions`", parts of the program "will not compile". Whether the
mix still runs at all is itself a Phase 2 observation that `EXPECT.md`
leaves open.