# Observation matrix

The living companion to `docs/design.md` §2. Rows are the six build targets;
columns are the four scenarios. Each cell records the **observed** behavior
with line-promoted links to the example's `EXPECT.md`. "—" means not yet run.

| Target | S1 baseline throw         | S2 suspend then throw | S3 suspend rejects | S4 catch then re-suspend |
|--------|---------------------------|-----------------------|--------------------|--------------------------|
| A      | [PASS](../examples/A/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/A/s2/EXPECT.md) [obs](../tests/A/s2.spec.ts-snapshots/A-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [FAIL](../examples/A/s3/EXPECT.md) [obs](../tests/A/s3.spec.ts-snapshots/A-S3-console-darwin.txt) `S3:before-suspend → [pageerror] S3` (catch missed entirely) | [FAIL](../examples/A/s4/EXPECT.md) [obs](../tests/A/s4.spec.ts-snapshots/A-S4-console-darwin.txt) `S4:before-suspend → [pageerror] S4` (catch missed, s4-2 never registered) |
| B      | [PASS](../examples/B/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | [PASS](../examples/B/s2/EXPECT.md) [obs](../tests/B/s2.spec.ts-snapshots/B-S2-console-darwin.txt) `S2:before-suspend → S2:after-resume → PASS:s2-catch-reached → S2 → PASS:s2-done` | [FAIL](../examples/B/s3/EXPECT.md) [obs](../tests/B/s3.spec.ts-snapshots/B-S3-console-darwin.txt) `S3:before-suspend → [pageerror] S3 → [timeout] no s3-done` | [FAIL](../examples/B/s4/EXPECT.md) [obs](../tests/B/s4.spec.ts-snapshots/B-S4-console-darwin.txt) `S4:before-suspend → [pageerror] S4` |
| C      | [FAIL](../examples/C/s1/EXPECT.md) [obs](../tests/C/s1.spec.ts-snapshots/C-S1-console-darwin.txt) `S1:before-throw → [pageerror] trying to suspend JS frames → [timeout] no s1-done` | [FAIL](../examples/C/s2/EXPECT.md) [obs](../tests/C/s2.spec.ts-snapshots/C-S2-console-darwin.txt) `S2:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s2-1 → [timeout] no s2-done` | [FAIL](../examples/C/s3/EXPECT.md) [obs](../tests/C/s3.spec.ts-snapshots/C-S3-console-darwin.txt) `S3:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s3-1 → [timeout] no s3-done` | [FAIL](../examples/C/s4/EXPECT.md) [obs](../tests/C/s4.spec.ts-snapshots/C-S4-console-darwin.txt) `S4:before-suspend → [pageerror] trying to suspend JS frames → [control-error] no pending controlled promise: s4-1` |
| D      | —                         | —                     | —                  | —                        |
| E      | —                         | —                     | —                  | —                        |
| E'     | —                         | —                     | —                  | —                        |

## Conventions

- A cell is filled only after its Playwright spec runs successfully.
- On pitfall reproduction (an "expected" failure), record the exact
  console sequence and link the `EXPECT.md` that explains the mechanism.
- The `PASS` / `FAIL` lines referenced here are Wasm-side
  `console.log("PASS:<id>")` / `console.log("FAIL:<id>")` signals.
- `[pageerror]` lines are JS `uncaughtException` events captured by Playwright,
  surfacing Wasm throws that escaped past the catch boundary.
