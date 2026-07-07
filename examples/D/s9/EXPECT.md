# D / S9 — expectation

Target D = JSPI + Wasm exception handling. S9 throws from C++, enters a catch
block, then calls a helper chain where the deeper helper suspends and resumes.

## Observed result

D reaches `PASS:s9-after-helper` and `PASS:s9-done`.
