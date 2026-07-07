# D / S11 — expectation

Target D = JSPI + Wasm exception handling. S11 captures a nested C++ exception
as `std::exception_ptr`, suspends, then rethrows and inspects the nested
exception.

## Observed result

D reaches `PASS:s11-outer-rethrow-catch-reached`,
`PASS:s11-nested-catch-reached`, and `PASS:s11-done`.
