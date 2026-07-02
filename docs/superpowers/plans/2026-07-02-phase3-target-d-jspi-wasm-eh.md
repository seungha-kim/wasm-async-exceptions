# Phase 3 — Target D JSPI + Wasm EH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and observe target D (`JSPI + Wasm EH`) across S1-S4, then record whether the fully standardized runtime path resolves the A/B rejection leak and the C JSPI+JS-EH failure.

**Architecture:** Reuse the shared A-D C++ scenarios and runtime helpers. Target D differs only by build flags (`-sASYNCIFY=2 -fwasm-exceptions`) and by using the JSPI page template already introduced for target C. Playwright specs follow the B/C snapshot style so the first run captures actual behavior before the matrix and findings are updated.

**Tech Stack:** Emscripten 6.0.1, JSPI via `-sASYNCIFY=2`, Wasm exception handling via `-fwasm-exceptions`, Playwright on stable Chrome.

---

## File Structure

| Path | Purpose |
|---|---|
| `examples/D/s{1,2,3,4}/build.sh` | Build each target D scenario with JSPI + Wasm EH. |
| `examples/D/s{1,2,3,4}/run.sh` | Build and run the matching Playwright spec. |
| `examples/D/s{1,2,3,4}/EXPECT.md` | Record the hypothesis for each D scenario. |
| `tests/D/s{1,2,3,4}.spec.ts` | Capture observed browser console behavior. |
| `tests/D/s{n}.spec.ts-snapshots/*` | Stable observed output for S2-S4, and S1 if it is not a strict exact-pass baseline. |
| `docs/matrix.md` | Fill the D row after observation. |
| `docs/findings.md` | Append Phase 3 analysis and migration checklist notes. |
| `README.md`, `docs/design.md` | Keep the reordered experiment roadmap aligned. |

## Task 1: RED tests for target D

- [ ] Create `tests/D/s1.spec.ts` through `tests/D/s4.spec.ts` by following the B-row snapshot pattern, pointing URLs at `examples/D/s<n>/build/index.html`.
- [ ] Run `npx playwright test D/`.
- [ ] Expected RED: tests fail because the D pages do not exist yet or cannot load generated artifacts.

## Task 2: Target D example scaffolding

- [ ] Create `examples/D/s1` through `examples/D/s4`.
- [ ] For each scenario, add `build.sh` with `-std=c++17 -O1 -sASYNCIFY=2 -sASYNCIFY_IMPORTS=['jsAwaitControlledPromise'] -fwasm-exceptions` plus the shared modularized export flags.
- [ ] Copy `src/page_template_jspi.html` and `src/test_harness.js` into each build directory from `build.sh`.
- [ ] Add `run.sh` for each scenario.
- [ ] Add `EXPECT.md` for each scenario explaining that D tests whether removing both Asyncify instrumentation and JS EH removes the Phase 2 failures.
- [ ] Run all four D build scripts under `source ./emsdk/emsdk_env.sh`.

## Task 3: Capture D observations

- [ ] Run `npx playwright test D/`.
- [ ] Promote first-run actual snapshots to `tests/D/*-snapshots/*-darwin.txt`.
- [ ] Re-run `npx playwright test D/` and confirm the D row is stable.

## Task 4: Record Phase 3 findings

- [ ] Update `docs/matrix.md` row D with links to D expectations and snapshots.
- [ ] Append a Phase 3 section to `docs/findings.md` with S1-S4 observed sequences.
- [ ] State whether D fixed A/B's JS-initiated rejection leak and C's `trying to suspend JS frames` failure.
- [ ] Add the first version of the JSPI+Wasm EH migration checklist requested by `docs/design.md` DoD.

## Task 5: Verification

- [ ] Run `source ./emsdk/emsdk_env.sh && npx playwright test`.
- [ ] Expected result: all A-D and feature tests pass.
- [ ] Commit the roadmap reorder and Phase 3 work.
