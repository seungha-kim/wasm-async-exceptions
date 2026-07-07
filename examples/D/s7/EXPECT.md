# D / S7 — expectation

Target D = JSPI + Wasm exception handling. Scenario S7 resolves a first
controlled Promise, throws from C++, catches internally, suspends inside that
catch, then rethrows to an outer catch.

## Hypothesis under test

This is the standard-path comparison point for A/B S7 and focuses on saved
exception/rethrow state across suspend. In the observed matrix A and D both
pass, while B fails before the outer catch.

## Observed result

D reaches `PASS:s7-outer-catch-reached` and `PASS:s7-done`.
