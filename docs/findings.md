# Findings

## Final summary

This project started with a narrow question: what happens when Emscripten's
Asyncify coroutine emulation and C++ exception support meet at an async
boundary?

The completed matrix gives a sharper answer:

- A JS Promise rejection from an async import does **not** automatically
  become a C++ exception that `catch` can observe.
- Switching one or both runtime axes to JSPI/Wasm EH changes code size and
  some failure surfaces, but it does not by itself define a C++ exception
  boundary for rejected JS Promises.
- C++20 coroutine glue works for all four scenarios because it treats JS
  settlement as data, resumes C++, and throws from C++ in `await_resume()`.

The practical rule is therefore:

> If C++ `catch` semantics are required after JS async work, do not rely on
> rejected Promises crossing the Wasm boundary as exceptions. Convert JS
> settlement into an explicit result/status, resume C++, and throw from C++.

## Target-level result

| Target | Result | Interpretation |
|---|---|---|
| A — Asyncify + JS EH | S2 passes; S3/S4 fail | C++ throw after resume works; JS rejection escapes. |
| B — Asyncify + Wasm EH | S1/S2 pass; S3/S4 fail | Wasm EH does not make rejected JS Promises catchable. |
| C — JSPI + JS EH | all scenarios fail in this harness | JS EH remains incompatible with this JSPI frame shape. |
| D — JSPI + Wasm EH | S1/S2 pass; S3/S4 fail | Runtime standards reduce glue, but JS rejection still escapes. |
| E — C++20 coroutine + JS EH | all scenarios pass | Developer-owned settlement conversion restores C++ control flow. |
| E' — C++20 coroutine + Wasm EH | all scenarios pass | Same behavioral result as E; Wasm EH mainly changes generated code shape. |

## Cost and surface evidence

`docs/metrics.md` records artifact sizes, load-to-completion timing, and
representative pageerror surfaces. The short version:

- Asyncify rows A/B carry the largest combined artifact footprint in suspend
  scenarios.
- JSPI rows C/D reduce generated code size but still need an explicit
  settlement boundary for JS rejection.
- E/E' avoid failure-timeout paths in S3/S4 because the rejected async
  settlement is converted into a C++ throw after coroutine resume.

## Detailed phase log

The rest of this file preserves the phase-by-phase observations in the order
they were gathered.

---

# Phase 1 — target A pitfall reproduction

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
- Phase 3 (target D: JSPI + Wasm EH) is the next milestone after Phase 2.
  Phase 2 showed that JSPI + JS EH fails even S1, so D is now the decisive
  test for whether removing JS EH restores the JSPI path.
- Phase 2.5 (targets E / E') explores the C++20-coroutine fallback after D.
  The design doc §1.4 prediction is "all four scenarios happy-path under
  both E and E'", and D's result will sharpen the comparison between runtime
  standard support and developer-owned coroutine glue.

## Phase 2 — One axis at a time (targets B and C)

Phase 2 tested whether changing only one runtime axis repairs the target A
pitfall. The short result is stricter than the original hypothesis: target B
does not repair the A-row JS-initiated rejection pitfall, and target C exposes
an earlier JSPI + JS EH incompatibility that fails even the synchronous throw
baseline.

Target B builds emitted this Emscripten warning on every scenario:
`ASYNCIFY=1 is not compatible with -fwasm-exceptions. Parts of the program
that mix ASYNCIFY and exceptions will not compile.` The binaries still built
and ran, so the row below records runtime behavior, but the warning is part
of the Phase 2 finding.

### B / S1 — synchronous throw (baseline)

Observed:
```
S1:before-throw
PASS:s1-catch-reached
S1
PASS:s1-done
```

Hypothesis check: Wasm EH compiled and ran for the no-suspend baseline.

### B / S2 — suspend then throw

Observed:
```
S2:before-suspend
S2:after-resume
PASS:s2-catch-reached
S2
PASS:s2-done
```

Mapping: B/S2 matches A/S2's happy path. A C++ throw initiated after the
resume returns is still caught correctly.

### B / S3 — suspend that rejects

Observed:
```
S3:before-suspend
[pageerror] S3
[timeout] no s3-done
```

Mapping to §1.2: Wasm EH alone did not recover the catch that A/S3 missed.
The JS-side Promise rejection still escaped to page-land before the Wasm
handler could observe it.

### B / S4 — catch then re-suspend

Observed:
```
S4:before-suspend
[pageerror] S4
```

Mapping: B/S4 collapses at the first rejection just like A/S4. The catch block
is never entered, so the second suspend remains untested on this row.

### C / S1 — synchronous throw (baseline)

Observed:
```
S1:before-throw
[pageerror] trying to suspend JS frames
[timeout] no s1-done
```

Hypothesis check: JSPI + JS exception emulation failed before any explicit
suspend scenario. The C++ throw path itself triggered V8's "trying to suspend
JS frames" error, so C cannot serve as a clean "JSPI only" improvement row
with JS EH still enabled.

### C / S2 — suspend then throw

Observed:
```
S2:before-suspend
[pageerror] trying to suspend JS frames
[control-error] no pending controlled promise: s2-1
[timeout] no s2-done
```

Mapping: JSPI alone did not preserve A/S2's happy path. The failure occurred
before the controlled Promise was registered, leaving the test harness with
no `s2-1` to resolve.

### C / S3 — suspend that rejects

Observed:
```
S3:before-suspend
[pageerror] trying to suspend JS frames
[control-error] no pending controlled promise: s3-1
[timeout] no s3-done
```

Mapping to §1.2: JSPI alone did not fix conflict #1 from A/S3. Instead, the
remaining JS exception emulation layer appears incompatible with the JSPI
stack-switch path in this Emscripten/V8 combination.

### C / S4 — catch then re-suspend

Observed:
```
S4:before-suspend
[pageerror] trying to suspend JS frames
[control-error] no pending controlled promise: s4-1
```

Mapping: C/S4 also fails before the first controlled Promise is registered,
so it never reaches the catch-handler-internal suspend that A/S4 could not
reach.

### Cross-row summary (Phase 2)

Changing only the exception axis (B: Asyncify + Wasm EH) was not enough to
fix the A-row Promise-rejection pitfall: B/S3 and B/S4 still miss the C++
catch. Changing only the coroutine axis (C: JSPI + JS EH) was worse in this
toolchain: the JS EH emulation path failed even S1 with `trying to suspend JS
frames`. The practical conclusion is that these axes are not independently
replaceable in the way the initial Phase 2 hypothesis hoped; JSPI needs to be
tested with Wasm EH before it can be treated as a viable exit.

### Implications for Phase 3 (target D)

Target D (JSPI + Wasm EH) is now the decisive test, not just the expected
union of B and C's gains. It must show both that removing JS EH eliminates
the C-row `trying to suspend JS frames` failure and that removing Asyncify
eliminates the A/B-row JS-initiated rejection leak.

## Phase 3 — Both runtime standards (target D)

Target D tested the fully standardized row: JSPI for stack switching and
Wasm exception handling for C++ throw/catch. It fixed the C-row baseline
failure, but it did **not** fix the JS-initiated Promise rejection leak seen
on A and B.

### D / S1 — synchronous throw (baseline)

Observed:
```
S1:before-throw
PASS:s1-catch-reached
S1
PASS:s1-done
```

Mapping: Removing JS exception emulation fixed C/S1's `trying to suspend JS
frames` failure. Plain C++ throw/catch under JSPI + Wasm EH works.

### D / S2 — suspend then throw

Observed:
```
S2:before-suspend
S2:after-resume
PASS:s2-catch-reached
S2
PASS:s2-done
```

Mapping: D preserves the happy path from A/B. A Promise resolution resumes
Wasm, then a C++-initiated throw is caught normally.

### D / S3 — suspend that rejects

Observed:
```
S3:before-suspend
[pageerror] S3
[timeout] no s3-done
```

Mapping to §1.2: D did not recover the catch for a rejected Promise. Even
with Wasm EH, a JS-side rejection from the suspending import surfaced as a
page error rather than as a C++ exception caught inside Wasm.

### D / S4 — catch then re-suspend

Observed:
```
S4:before-suspend
[pageerror] S4
[control-error] no pending controlled promise: s4-2
[timeout] no s4-done
```

Mapping: D/S4 failed at the first rejection, so the catch block never
registered `s4-2`. This matches A/B's failure shape rather than the predicted
complete-standard happy path.

### Cross-row summary (Phase 3)

D splits the Phase 2 question cleanly. Wasm EH is enough to remove C's
`trying to suspend JS frames` failure, but JSPI + Wasm EH is still not enough
to translate a rejected JS Promise into a C++ catchable exception for these
`EM_ASYNC_JS` imports. The persistent S3/S4 failure now looks less like a
JS EH emulation issue and more like a boundary semantic issue: JS Promise
rejection remains a JS exception at the suspend boundary, while C++ catch
only sees exceptions thrown from inside Wasm/C++ control flow.

### JSPI + Wasm EH checklist

- Use Wasm EH to avoid JS exception emulation failures on synchronous C++
  throw/catch and C++ throws after a successful resume.
- Do not assume a rejected JS Promise from an async import becomes a C++
  catchable exception. Test that path explicitly.
- Prefer resolving async imports with a status/result value and throwing from
  C++ after resume if C++ catch semantics are required.
- Keep Playwright coverage for both resolution and rejection paths; S2 passing
  does not imply S3/S4 are safe.
- Treat JSPI support as experimental in Emscripten 6.0.1 and pin the toolchain
  when recording observations.

### Implications for Phase 2.5 (targets E / E')

The next useful comparison is no longer "D is the complete fix versus E/E' as
manual fallback." Instead, E/E' should test whether owning the suspend/resume
protocol in C++20 coroutine glue lets the project intentionally convert JS
settlement states into C++ control flow, rather than relying on Promise
rejection to cross the Wasm boundary as a C++ exception.

## Phase 2.5 — C++20 coroutine-owned settlement (targets E and E')

Targets E and E' remove Asyncify/JSPI from the coroutine axis entirely. The
Wasm stack is not suspended by the runtime; instead, the C++ coroutine stores
its frame on the heap, returns to JS, and JS later resumes the coroutine by
handle. Promise settlement is represented as an explicit status value, and
`await_resume()` turns rejected settlement into a C++ `std::runtime_error`.

This row is therefore not "Promise rejection crosses into C++". It is
"developer-owned glue converts settlement into C++ control flow."

### E / S1 and E' / S1 — synchronous throw

Observed on both rows:
```
S1:before-throw
PASS:s1-catch-reached
S1
PASS:s1-done
```

Mapping: The no-await baseline passes with both JS EH (E) and Wasm EH (E').

### E / S2 and E' / S2 — coroutine await then throw

Observed on both rows:
```
S2:before-suspend
S2:after-resume
PASS:s2-catch-reached
S2
PASS:s2-done
```

Mapping: JS resolves the stored coroutine handle, C++ resumes after
`co_await`, then a C++-initiated throw is caught normally.

### E / S3 and E' / S3 — coroutine await rejects

Observed on both rows:
```
S3:before-suspend
PASS:s3-catch-reached
s3-1
PASS:s3-done
```

Mapping: This is the first row where the rejected async operation reaches the
C++ catch by design. JS does not throw into Wasm; it sets a rejected status
and resumes the coroutine, and C++ throws from `await_resume()`.

### E / S4 and E' / S4 — catch then re-await

Observed on both rows:
```
S4:before-suspend
PASS:s4-catch-reached
s4-1
S4:before-second-suspend
PASS:s4-after-second-resume
PASS:s4-done
```

Mapping: The staged flow that A/B/D never reached does work when the
coroutine glue owns settlement conversion. One C++ caveat surfaced during
implementation: standard C++ does not allow `co_await` directly inside a
`catch` handler, so the scenario records the catch result and performs the
second await immediately after the catch block in the same coroutine frame.

### Cross-row summary (Phase 2.5)

E and E' pass all four scenarios because they avoid the ambiguous JS Promise
rejection boundary. The cost is explicit glue: `promise_type`, awaiter state,
handle registration, resume exports, and a JS registry that maps settlement
back into C++. E' did not differ behaviorally from E in this matrix because
the decisive fix was not the exception mechanism; it was owning the
settlement protocol and throwing from C++ after resume.

### Final research summary

The completed A-D rows show that runtime stack-switching and Wasm EH do not
automatically make rejected JS Promises catchable as C++ exceptions. The E/E'
rows show the reliable pattern: treat JS async settlement as data at the
boundary, resume the C++ coroutine, and throw from C++ if C++ catch semantics
are required.

## Phase 3.5 — Cost and error-surface metrics

Detailed measurements live in `docs/metrics.md`. The high-level result is:

- Asyncify rows A/B carry the largest combined artifact footprint in the
  suspend scenarios.
- JSPI rows C/D reduce generated code size, but D still shows that Wasm EH
  does not turn rejected JS Promises into C++ catchable exceptions.
- C++20 coroutine rows E/E' trade runtime stack-switching machinery for
  developer-owned glue. Their passing S3/S4 timing stays in the normal
  tens-of-milliseconds range because rejected settlement is converted into a
  C++ throw from `await_resume()`, rather than waiting for the failure timeout.

The metrics reinforce the main conclusion: the reliable boundary is not
"Promise rejection crosses into C++"; it is "JS settlement is data, and C++
chooses whether to throw after resume."
