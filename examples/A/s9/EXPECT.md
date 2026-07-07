# A / S9 — expectation

Target A = Asyncify + JS exception emulation. S9 throws from C++, enters a
catch block, then calls a helper chain where the deeper helper suspends and
resumes.

## Observed result

A reaches `PASS:s9-after-helper` and `PASS:s9-done`.
