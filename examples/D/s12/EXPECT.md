# D / S12 — expectation

Target D = JSPI + Wasm exception handling. S12 catches a C++ exception, stores
`std::exception_ptr`, leaves the catch block, suspends and resumes, then calls
`std::rethrow_exception`.

## Observed result

D reaches `PASS:s12-rethrow-catch-reached` and `PASS:s12-done`.
