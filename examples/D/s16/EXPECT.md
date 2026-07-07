# D / S16 — expectation

Target D = JSPI + Wasm exception handling. S16 copies `what()` into an ordinary
`std::string`, leaves the catch block, suspends, then reads the string.

## Observed result

D reaches `PASS:s16-string-readable` and `PASS:s16-done`.
