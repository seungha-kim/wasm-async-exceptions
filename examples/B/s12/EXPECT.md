# B / S12 — expectation

Target B = Asyncify + Wasm exception handling. S12 catches a C++ exception,
stores `std::exception_ptr`, leaves the catch block, suspends and resumes, then
calls `std::rethrow_exception`.

## Observed result

B resumes from `s12-2`, then fails with `[pageerror] null function`,
`[pageerror] unreachable`, and never logs `PASS:s12-done`.

This expands the failure boundary beyond an active catch frame. A captured
exception object/state crossing an Asyncify suspend and later being rethrown is
also unsafe on Asyncify + Wasm EH in this harness.
