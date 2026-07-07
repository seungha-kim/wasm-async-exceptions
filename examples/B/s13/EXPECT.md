# B / S13 — expectation

Target B = Asyncify + Wasm exception handling. S13 catches a
`std::runtime_error`, copies the exception object, leaves the catch block,
suspends, then reads the copied object.

## Observed result

B reaches `PASS:s13-copied-object-readable` and `PASS:s13-done`, then reports
`[pageerror] unreachable`.

The copied object payload survives the suspend, but the post-done pageerror
shows this is not a clean completion on Asyncify + Wasm EH.
