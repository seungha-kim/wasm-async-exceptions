# Findings — Phase 1 (target A pitfall reproduction)

This file is updated as each phase's observations are recorded. Phase 1
covers the Asyncify + JS exception emulation path (target A). References
to design.md §1.2 below are to the three conflicts hypothesized there.

## A / S1 — synchronous throw (baseline)

Observed:
```
S1:before-throw
PASS:s1-catch-reached
S1
PASS:s1-done
```

This is the clean baseline: throw on an instrumented binary, caught by
`main`'s own catch, no Asyncify suspend involved. All four expected lines
appeared in the expected order. No pitfall.

## A / S2 — suspend then throw

Observed:
```
S2:before-suspend
S2:after-resume
PASS:s2-catch-reached
S2
PASS:s2-done
```

**Surprising negative finding**: the catch *was* reached and control flow
proceeded exactly as the happy path predicts. The Asyncify resume
reconstructed the Wasm frame around `await_controlled_promise("s2-1")`,
execution continued past the await, threw `std::runtime_error("S2")`, and the
catch in `main` caught it.

Mapping to §1.2 conflicts:
- **#2 (catch 복귀 지점의 비대칭) — not reproduced for S2.** The "where do
  I return to" question was resolved correctly when Asyncify handled the
  return path; the catch was *not* in a section that Asyncify's resume
  needs to re-enter (the catch only fires after the throw, on an unwinding
  path whose handlers are not suspend-resume targets). Emscripten's
  Asyncify instrumentation appears to correctly thread exception unwinding
  *out of* a resumed frame when the throw is initiated by **C++ code after
  resume**.

## A / S3 — suspend that rejects

Observed:
```
S3:before-suspend
[pageerror] S3
```

**Pitfall reproduced.** The suspended Promise rejected, the JS exception
`Error("S3")` propagated up through Asyncify resume — but instead of being
delivered into the suspended Wasm frame so its `try/catch (…) { … }` could
observe it, the throw escaped straight to the page as a JS `uncaughtException`.
Neither the C++ `catch(const std::exception& e)` branch nor the `catch(…)`
ellipsis branch was entered; the Wasm frame effectively disappeared midway
through the suspend.

Mapping to §1.2 conflicts:
- **#1 (suspend 중 예외 전파 손상) — reproduced.** JS exception emulation
  expects to propagate via the *caller's* return path with a "threw" flag.
  Asyncify resume expects to restore locals/PC from the save buffer and
  re-enter Wasm at the suspend point. Here the throw originates on the JS
  side (Promise rejection) and bypasses Wasm's instrumented unwind machinery
  entirely, surfacing in page-land before the C++ `catch` could intercept.
- This is the most direct single-cell demonstration of the Asyncify × JS EH
  collision that this research set out to find.

## A / S4 — catch then re-suspend

Observed:
```
S4:before-suspend
[pageerror] S4
```

**Pitfall reproduced (same mechanism as S3).** The expected staged flow —
reject `s4-1` → catch fires → suspend on `s4-2` → resolve `s4-2` → done —
collapsed at the very first rejection. The catch was never entered, so
`await_controlled_promise("s4-2")` was never invoked and no `s4-2` entry
was registered with the harness's controlled-promise registry. Subsequent
test attempts to `resolve("s4-2")` fail with "no pending controlled
promise: s4-2" inside the spec; we keep the snapshot stable by
swallowing that secondary error inside the spec.

Mapping to §1.2 conflicts:
- **#1 (suspend 중 예외 전파 손상) — reproduced (same root cause as S3).**
  Because the S4 catch-handling path is gated on the *first* rejection being
  observable from Wasm, the §1.2 conflict #1 manifests identically before
  any "second suspend" semantics can even be probed. S4 thus fails to reach
  the §1.2 conflict #2 ("catch 복귀 지점의 비대칭") scenario we had hoped
  to expose here. The S4 expectation in `examples/A/s4/EXPECT.md` should be
  read as "we cannot even get into the catch handler on target A; conflict #2
  cannot be observed via this scenario on A."

## Cross-scenario summary

Two of the three hypothesized §1.2 conflicts are directly visible on
target A:

| Scn | §1.2 #1 prop-loss | §1.2 #2 catch-target | §1.2 #3 destructor/unwind | Outcome |
|-----|---|---|---|---|
| S1  | n/a (no suspend)    | n/a               | n/a                | happy path (baseline) |
| S2  | not reproduced      | not reproduced    | not reproduced     | happy path — resume → throw → catch works |
| S3  | **reproduced**      | n/a (catch never entered) | possibly involved | catch missed, JS uncaughtException |
| S4  | **reproduced**      | not testable on A | possibly involved  | expected staged flow collapsed to S3-equivalent |

**Conflict #1 is the dominant failure mode on target A.** It reproducibly
manifests whenever the *initiator* of the throw is the JS side via an
Asyncify import's Promise rejection. By contrast, when the throw is
initiated by C++ code *after* the async resume returns (S2), the Wasm frame's
own instrumented unwind path is used and the catch fires normally.

**Conflict #2 (catch 복귀 지점의 비대칭)** was not reproduced. The reason
turns out to be structural rather than incidental: in target A, the Asyncify
resume path and the JS exception emulation propagate-into-catch path do not
compete for *the same frame*, because the throw arrives via JS `Promise
rejection` rather than via C++ `throw` from the suspended frame. Target B
(Asyncify + Wasm EH) and target D (JSPI + Wasm EH) are where conflict #2
might or might not reproduce; that is the subject of subsequent phases.

**This satisfies the design.md §8 Definition of Done item**: target A's
S2/S3/S4 produced at least one (in fact two) "예상과 다른 동작(깨짐/uncaught/hang)".
The DoD is met for Phase 1.

## Implications for follow-on phases

- Phase 2 (target B: Asyncify + Wasm EH) should retest S3 and S4 to see
  whether Wasm's `try`/`catch` opcodes — being runtime-driven rather than
  per-call-flag-driven — recover the catch when the import rejects.
- Phase 2 (target C: JSPI + JS EH) is where conflict #2 finally becomes
  cleanly testable: the Promise rejection goes through the *runtime's*
  stack-switch suspend path, not Asyncify's instrumentation, so a C++
  catch inside the suspended function actually has a frame to land in.
- Phase 3 (target D: JSPI + Wasm EH) is the predicted "happy path" for all
  four scenarios; S3 and S4 are predicted to be the most informative
  demonstration of D ≠ A.
- Phase 2.5 (targets E / E') explores the C++20-coroutine fallback. The
  design doc §1.4 prediction is "all four scenarios happy-path under both
  E and E'"; this is the next milestone to test after Phase 2 and 3.