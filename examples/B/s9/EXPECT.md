# B / S9 — expectation

Target B = Asyncify + Wasm exception handling. S9 throws from C++, enters a
catch block, then calls a helper chain where the deeper helper suspends and
resumes.

## Observed result

B resumes the helper and reaches `PASS:s9-after-helper`, then fails with
`[pageerror] null function`, `[pageerror] unreachable`, and never logs
`PASS:s9-done`.

This extends S5: the suspend does not need to occur directly in the catch
block. It is enough that catch state remains live in an outer frame while a
deeper helper suspends.
