# A / S15 — expectation

Target A = Asyncify + JS exception emulation. S15 saves a stable `what()`
pointer from a custom exception whose payload is a string literal, leaves the
catch block, suspends, then reads the pointer.

## Observed result

A reaches `PASS:s15-pointer-readable` and `PASS:s15-done`.
