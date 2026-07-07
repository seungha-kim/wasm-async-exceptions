# D / S13 — expectation

Target D = JSPI + Wasm exception handling. S13 catches a `std::runtime_error`,
copies the exception object, leaves the catch block, suspends, then reads the
copied object.

## Observed result

D reaches `PASS:s13-copied-object-readable` and `PASS:s13-done`.
