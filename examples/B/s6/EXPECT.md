# B / S6 — expectation

Target B = Asyncify + Wasm exception handling. Scenario S6 resolves an initial
controlled Promise, throws from C++, and then suspends from a destructor running
during C++ stack unwind.

## Hypothesis under test

This checks whether Wasm EH changes destructor-cleanup suspend behavior while
Asyncify still owns suspend/resume.

## Observed result

The destructor resumes and logs `PASS:s6-dtor-after-resume`, then the page
reports `[pageerror] null function` and `[pageerror] unreachable`. The outer
catch/done sequence is never reached. This is the strongest B-row stress
failure because it occurs during C++ exception unwind with no rejected JS
Promise.
