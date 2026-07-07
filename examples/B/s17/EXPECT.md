# B / S17 — expectation

Target B = Asyncify + Wasm exception handling. S17 suspends first, then creates
an `std::exception_ptr` after resume and rethrows it before any later suspend.

## Observed result

B reaches `PASS:s17-rethrow-catch-reached` and `PASS:s17-done`.

This shows `std::exception_ptr` is not inherently unusable on B. The S12/S11
failure requires captured exception state to cross the Asyncify suspend before
being reactivated.
