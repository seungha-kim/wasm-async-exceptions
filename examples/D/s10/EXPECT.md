# D / S10 — expectation

Target D = JSPI + Wasm exception handling. S10 throws from C++, starts stack
unwinding, then a destructor calls a helper chain where the deeper helper
suspends and resumes.

## Observed result

D reaches `PASS:s10-dtor-after-helper`, catches `S10`, and logs
`PASS:s10-done`.
