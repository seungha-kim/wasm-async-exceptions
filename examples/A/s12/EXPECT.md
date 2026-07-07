# A / S12 — expectation

Target A = Asyncify + JS exception emulation. S12 catches a C++ exception,
stores `std::exception_ptr`, leaves the catch block, suspends and resumes, then
calls `std::rethrow_exception`.

## Observed result

A reaches `PASS:s12-rethrow-catch-reached` and `PASS:s12-done`.
