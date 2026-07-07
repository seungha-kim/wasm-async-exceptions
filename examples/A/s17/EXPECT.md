# A / S17 — expectation

Target A = Asyncify + JS exception emulation. S17 suspends first, then creates
an `std::exception_ptr` after resume and rethrows it before any later suspend.

## Observed result

A reaches `PASS:s17-rethrow-catch-reached` and `PASS:s17-done`.
