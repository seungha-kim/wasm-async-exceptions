# D / S4 — expectation

Target D = JSPI + Wasm exception handling. Scenario S4 rejects the first
controlled Promise, catches it in C++, then suspends again inside the catch
block and resolves the second Promise.

## Hypothesis under test

D is the first row that should be able to test the full staged S4 flow:
first rejection reaches the C++ catch, `s4-2` is registered from inside that
catch block, and the second resume completes with `PASS:s4-done`.
