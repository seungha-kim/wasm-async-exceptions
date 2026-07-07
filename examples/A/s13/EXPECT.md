# A / S13 — expectation

Target A = Asyncify + JS exception emulation. S13 catches a
`std::runtime_error`, copies the exception object, leaves the catch block,
suspends, then reads the copied object.

## Observed result

A reaches `PASS:s13-copied-object-readable` and `PASS:s13-done`.
