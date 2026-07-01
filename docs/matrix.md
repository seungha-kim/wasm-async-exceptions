# Observation matrix

The living companion to `docs/design.md` §2. Rows are the six build targets;
columns are the four scenarios. Each cell records the **observed** behavior
with line-promoted links to the example's `EXPECT.md`. "—" means not yet run.

| Target | S1 baseline throw         | S2 suspend then throw | S3 suspend rejects | S4 catch then re-suspend |
|--------|---------------------------|-----------------------|--------------------|--------------------------|
| A      | [PASS](../examples/A/s1/EXPECT.md) `S1:before-throw → PASS:s1-catch-reached → S1 → PASS:s1-done` | — | — | — |
| B      | —                         | —                     | —                  | —                        |
| C      | —                         | —                     | —                  | —                        |
| D      | —                         | —                     | —                  | —                        |
| E      | —                         | —                     | —                  | —                        |
| E'     | —                         | —                     | —                  | —                        |

## Conventions

- A cell is filled only after its Playwright spec runs successfully.
- On pitfall reproduction (an "expected" failure), record the exact
  console sequence and link the `EXPECT.md` that explains the mechanism.
- The `PASS` / `FAIL` lines referenced here are Wasm-side
  `console.log("PASS:<id>")` / `console.log("FAIL:<id>")` signals.