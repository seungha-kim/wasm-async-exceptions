# A / S16 — expectation

Target A = Asyncify + JS exception emulation. S16 copies `what()` into an
ordinary `std::string`, leaves the catch block, suspends, then reads the
string.

## Observed result

A reaches `PASS:s16-string-readable` and `PASS:s16-done`.
