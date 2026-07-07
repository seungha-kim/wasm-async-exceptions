# Observation matrix

The living companion to `docs/design.md` §2. Rows are the six build targets;
columns are the four scenarios. Each cell records the **observed** behavior
with line-promoted links to the example's `EXPECT.md`. "—" means not yet run.

| Target | S1 baseline throw         | S2 suspend then throw | S3 suspend rejects | S4 catch then re-suspend |
|--------|---------------------------|-----------------------|--------------------|--------------------------|
| A      | [PASS](../examples/A/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/A/s2/EXPECT.md) [obs](../tests/A/s2.spec.ts-snapshots/A-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [FAIL](../examples/A/s3/EXPECT.md) [obs](../tests/A/s3.spec.ts-snapshots/A-S3-console-darwin.txt) `S3:before-suspend → [pageerror] S3` (catch missed entirely) | [FAIL](../examples/A/s4/EXPECT.md) [obs](../tests/A/s4.spec.ts-snapshots/A-S4-console-darwin.txt) `S4:before-suspend → [pageerror] S4` (catch missed, s4-2 never registered) |
| B      | [PASS](../examples/B/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/B/s2/EXPECT.md) [obs](../tests/B/s2.spec.ts-snapshots/B-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [FAIL](../examples/B/s3/EXPECT.md) [obs](../tests/B/s3.spec.ts-snapshots/B-S3-console-darwin.txt) `S3:before-suspend → [pageerror] S3 → [timeout] no s3-done` | [FAIL](../examples/B/s4/EXPECT.md) [obs](../tests/B/s4.spec.ts-snapshots/B-S4-console-darwin.txt) `S4:before-suspend → [pageerror] S4` |
| C      | [FAIL](../examples/C/s1/EXPECT.md) [obs](../tests/C/s1.spec.ts-snapshots/C-S1-console-darwin.txt) `S1:before-throw → [pageerror] trying to suspend JS frames → [timeout] no s1-done` | [FAIL](../examples/C/s2/EXPECT.md) [obs](../tests/C/s2.spec.ts-snapshots/C-S2-console-darwin.txt) `S2:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s2-1 → [timeout] no s2-done` | [FAIL](../examples/C/s3/EXPECT.md) [obs](../tests/C/s3.spec.ts-snapshots/C-S3-console-darwin.txt) `S3:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s3-1 → [timeout] no s3-done` | [FAIL](../examples/C/s4/EXPECT.md) [obs](../tests/C/s4.spec.ts-snapshots/C-S4-console-darwin.txt) `S4:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s4-1` |
| D      | [PASS](../examples/D/s1/EXPECT.md) [obs](../tests/D/s1.spec.ts-snapshots/D-S1-console-darwin.txt) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/D/s2/EXPECT.md) [obs](../tests/D/s2.spec.ts-snapshots/D-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [FAIL](../examples/D/s3/EXPECT.md) [obs](../tests/D/s3.spec.ts-snapshots/D-S3-console-darwin.txt) `S3:before-suspend → [pageerror] S3 → [timeout] no s3-done` | [FAIL](../examples/D/s4/EXPECT.md) [obs](../tests/D/s4.spec.ts-snapshots/D-S4-console-darwin.txt) `S4:before-suspend → [pageerror] S4 → [control-error] no pending controlled promise: s4-2 → [timeout] no s4-done` |
| E      | [PASS](../examples/E/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/E/s2/EXPECT.md) [obs](../tests/E/s2.spec.ts-snapshots/E-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [PASS](../examples/E/s3/EXPECT.md) [obs](../tests/E/s3.spec.ts-snapshots/E-S3-console-darwin.txt) `S3:before-suspend → PASS:s3-catch-reached → s3-1 → PASS:s3-done` | [PASS](../examples/E/s4/EXPECT.md) [obs](../tests/E/s4.spec.ts-snapshots/E-S4-console-darwin.txt) `S4:before-suspend → PASS:s4-catch-reached → s4-1 → S4:before-second-suspend → PASS:s4-after-second-resume → PASS:s4-done` |
| E'     | [PASS](../examples/Ep/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/Ep/s2/EXPECT.md) [obs](../tests/Ep/s2.spec.ts-snapshots/Ep-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [PASS](../examples/Ep/s3/EXPECT.md) [obs](../tests/Ep/s3.spec.ts-snapshots/Ep-S3-console-darwin.txt) `S3:before-suspend → PASS:s3-catch-reached → s3-1 → PASS:s3-done` | [PASS](../examples/Ep/s4/EXPECT.md) [obs](../tests/Ep/s4.spec.ts-snapshots/Ep-S4-console-darwin.txt) `S4:before-suspend → PASS:s4-catch-reached → s4-1 → S4:before-second-suspend → PASS:s4-after-second-resume → PASS:s4-done` |

## Resolution-only C++ exception stress scenarios

S5-S8 were added after the first matrix to remove JS Promise rejection from
the experiment. Every controlled Promise is resolved; failures therefore point
at C++ exception/suspend interaction rather than JS rejection crossing the
Wasm boundary.

These scenarios are run only on A/B/D:

- A: practical Asyncify + JS exception emulation baseline.
- B: Asyncify + Wasm EH, useful for isolating the EH-axis change and now
  documented as a fragile intermediate path.
- D: JSPI + Wasm EH, the fully standardized runtime path.

| Target | S5 C++ throw → catch → suspend in catch | S6 destructor suspends during C++ unwind | S7 catch → suspend → rethrow | S8 multi-yield call chain → inner throw |
|--------|-----------------------------------------|-------------------------------------------|-------------------------------|------------------------------------------|
| A      | [PASS](../examples/A/s5/EXPECT.md) [obs](../tests/A/s5.spec.ts-snapshots/A-S5-console-darwin.txt) `S5:before-first-suspend → S5:after-first-resume → PASS:s5-catch-reached → S5 → S5:catch-before-suspend → PASS:s5-after-catch-resume → PASS:s5-done` | [PASS](../examples/A/s6/EXPECT.md) [obs](../tests/A/s6.spec.ts-snapshots/A-S6-console-darwin.txt) `S6:before-work-suspend → S6:after-work-resume → S6:dtor-before-suspend → PASS:s6-dtor-after-resume → PASS:s6-catch-reached → S6 → PASS:s6-done` | [PASS](../examples/A/s7/EXPECT.md) [obs](../tests/A/s7.spec.ts-snapshots/A-S7-console-darwin.txt) `S7:before-first-suspend → S7:after-first-resume → S7:inner-catch → S7 → S7:after-inner-resume → PASS:s7-outer-catch-reached → S7 → PASS:s7-done` | [PASS](../examples/A/s8/EXPECT.md) [obs](../tests/A/s8.spec.ts-snapshots/A-S8-console-darwin.txt) `S8:l1-before-suspend → ... → PASS:s8-outer-catch-reached → S8 → PASS:s8-done` |
| B      | [FAIL](../examples/B/s5/EXPECT.md) [obs](../tests/B/s5.spec.ts-snapshots/B-S5-console-darwin.txt) `... → PASS:s5-after-catch-resume → [pageerror] null function → [pageerror] unreachable → [timeout] no PASS:s5-done` | [FAIL](../examples/B/s6/EXPECT.md) [obs](../tests/B/s6.spec.ts-snapshots/B-S6-console-darwin.txt) `... → PASS:s6-dtor-after-resume → [pageerror] null function → [pageerror] unreachable → [timeout] no PASS:s6-done` | [FAIL](../examples/B/s7/EXPECT.md) [obs](../tests/B/s7.spec.ts-snapshots/B-S7-console-darwin.txt) `... → S7:after-inner-resume → [pageerror] null function → [pageerror] unreachable → [timeout] no PASS:s7-done` | [PASS](../examples/B/s8/EXPECT.md) [obs](../tests/B/s8.spec.ts-snapshots/B-S8-console-darwin.txt) `S8:l1-before-suspend → ... → PASS:s8-outer-catch-reached → S8 → PASS:s8-done` |
| D      | [PASS](../examples/D/s5/EXPECT.md) [obs](../tests/D/s5.spec.ts-snapshots/D-S5-console-darwin.txt) `S5:before-first-suspend → S5:after-first-resume → PASS:s5-catch-reached → S5 → S5:catch-before-suspend → PASS:s5-after-catch-resume → PASS:s5-done` | [PASS](../examples/D/s6/EXPECT.md) [obs](../tests/D/s6.spec.ts-snapshots/D-S6-console-darwin.txt) `S6:before-work-suspend → S6:after-work-resume → S6:dtor-before-suspend → PASS:s6-dtor-after-resume → PASS:s6-catch-reached → S6 → PASS:s6-done` | [PASS](../examples/D/s7/EXPECT.md) [obs](../tests/D/s7.spec.ts-snapshots/D-S7-console-darwin.txt) `S7:before-first-suspend → S7:after-first-resume → S7:inner-catch → S7 → S7:after-inner-resume → PASS:s7-outer-catch-reached → S7 → PASS:s7-done` | [PASS](../examples/D/s8/EXPECT.md) [obs](../tests/D/s8.spec.ts-snapshots/D-S8-console-darwin.txt) `S8:l1-before-suspend → ... → PASS:s8-outer-catch-reached → S8 → PASS:s8-done` |

## Conventions

- A cell is filled only after its Playwright spec runs successfully.
- On pitfall reproduction (an "expected" failure), record the exact
  console sequence and link the `EXPECT.md` that explains the mechanism.
- The `PASS` / `FAIL` lines referenced here are Wasm-side
  `console.log("PASS:<id>")` / `console.log("FAIL:<id>")` signals.
- `[pageerror]` lines are JS `uncaughtException` events captured by Playwright,
  surfacing Wasm throws that escaped past the catch boundary.
