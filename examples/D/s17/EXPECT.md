# D / S17 — expectation

Target D = JSPI + Wasm exception handling. S17 suspends first, then creates an
`std::exception_ptr` after resume and rethrows it before any later suspend.

## Observed result

D reaches `PASS:s17-rethrow-catch-reached` and `PASS:s17-done`.
