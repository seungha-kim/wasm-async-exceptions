# B / S15 — expectation

Target B = Asyncify + Wasm exception handling. S15 saves a stable `what()`
pointer from a custom exception whose payload is a string literal, leaves the
catch block, suspends, then reads the pointer.

## Observed result

B reaches `PASS:s15-pointer-readable` and `PASS:s15-done`, then reports
`[pageerror] unreachable`.

The stable pointer payload survives the suspend. The remaining failure surface
is a post-done runtime trap, not a missed payload read.
