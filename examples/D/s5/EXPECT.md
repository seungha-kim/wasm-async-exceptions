# D / S5 — expectation

Target D = JSPI + Wasm exception handling. Scenario S5 resolves a first
controlled Promise, throws from C++, catches it, then suspends again inside the
catch block.

## Hypothesis under test

This is the standard-path comparison point for A/B S5. In the observed matrix
A and D both pass, while B fails; the useful distinction is therefore
Asyncify+Wasm-EH versus JSPI+Wasm-EH, not A versus D.

## Observed result

D reaches `PASS:s5-done`.
