# A / S11 — expectation

Target A = Asyncify + JS exception emulation. S11 captures a nested C++
exception as `std::exception_ptr`, suspends, then rethrows and inspects the
nested exception.

## Observed result

A reaches `PASS:s11-outer-rethrow-catch-reached`,
`PASS:s11-nested-catch-reached`, and `PASS:s11-done`.
