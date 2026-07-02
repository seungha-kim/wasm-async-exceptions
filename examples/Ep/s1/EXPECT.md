# E' / S1 — expectation

Target E' = C++20 coroutine glue + Wasm EH. S1 is the no-await synchronous
throw/catch baseline.

Expected: `S1:before-throw -> PASS:s1-catch-reached -> S1 -> PASS:s1-done`.
