# D / S5 — expectation

Target D = JSPI + Wasm exception handling. Scenario S5 resolves a first
controlled Promise, throws from C++, catches it, then suspends again inside the
catch block.

## Hypothesis under test

This is the standard-path comparison point for A/S5. A pass here with an A
failure would support a concrete correctness advantage for JSPI + Wasm EH.
