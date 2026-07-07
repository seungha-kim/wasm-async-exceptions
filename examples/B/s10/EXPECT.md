# B / S10 — expectation

Target B = Asyncify + Wasm exception handling. S10 throws from C++, starts
stack unwinding, then a destructor calls a helper chain where the deeper helper
suspends and resumes.

## Observed result

B resumes the helper and reaches `PASS:s10-dtor-after-helper`, then fails with
`[pageerror] null function`, `[pageerror] unreachable`, and never logs
`PASS:s10-done`.

This extends S6: the suspend can be one helper call below the destructor and
still corrupt the Asyncify + Wasm EH unwind path.
