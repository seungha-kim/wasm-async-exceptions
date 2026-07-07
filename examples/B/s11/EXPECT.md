# B / S11 — expectation

Target B = Asyncify + Wasm exception handling. S11 captures a nested C++
exception as `std::exception_ptr`, suspends, then tries to rethrow and inspect
the nested exception.

## Observed result

B resumes from `s11-2`, then fails with `[pageerror] null function`,
`[pageerror] unreachable`, and never logs `PASS:s11-done`.

This matches S12's captured-exception-state failure, now with a nested
exception produced by `std::throw_with_nested`.
