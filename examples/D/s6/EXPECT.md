# D / S6 — expectation

Target D = JSPI + Wasm exception handling. Scenario S6 resolves an initial
controlled Promise, throws from C++, and then suspends from a destructor running
during C++ stack unwind.

## Hypothesis under test

This is the standard-path comparison point for A/B S6. In the observed matrix
A and D both pass, while B fails after destructor resume.

## Observed result

D reaches `PASS:s6-done`. This contrasts with B's `null function` /
`unreachable` failure on the same resolution-only C++ unwind stress path.
