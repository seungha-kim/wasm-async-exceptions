# A / S2 — expectation

Target A = Asyncify instrumentation + JS exception emulation; scenario S2 =
suspend on a controlled Promise, then after resume throw inside main's try
block, with the catch-of-main expectation.

## If Asyncify × JS EH do not conflict (ideal/happy path)

Console (in order):
1. `S2:before-suspend`
2. `S2:after-resume`
3. `PASS:s2-catch-reached`
4. `S2`
5. `PASS:s2-done`

## Hypothesis under test (design.md §1.2 conflict #2 + #3)

On Asyncify resume, the in-flight Wasm frame is reconstructed from the
save buffer; the JS exception emulation's "threw flag" propagation traverses
the *reconstructed* return path. We expect either:
- the catch is missed and the throw escapes to JS (`uncaught`); or
- the `unreachable` trap fires on re-entering the suspended frame while
  exception state still has `threw=true`; or
- the program hangs (Asyncify state never unwinds past the catch).

The spec records whatever actually happens so `docs/matrix.md` can document
the exact failure.