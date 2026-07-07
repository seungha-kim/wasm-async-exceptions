# B / S16 — expectation

Target B = Asyncify + Wasm exception handling. S16 copies `what()` into an
ordinary `std::string`, leaves the catch block, suspends, then reads the
string.

## Observed result

B reaches `PASS:s16-string-readable` and `PASS:s16-done`, then reports
`[pageerror] unreachable`.

The copied string payload survives the suspend. As in S13/S15, B still has a
post-done runtime trap after a caught Wasm EH exception followed by a later
Asyncify suspend.
