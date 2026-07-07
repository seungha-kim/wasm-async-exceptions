# S11-S17 Exception Edge Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S11, S13, S15, S16, and S17 for targets A/B/D to isolate which exception-related values can cross resolved async boundaries.

**Architecture:** Reuse the existing resolution-only Playwright helper and A/B/D example layout. Each scenario is a standalone C++17 source under `src/scenarios`, registered in CMake only for A/B/D, with target-specific wrappers, snapshots, EXPECT files, and docs.

**Tech Stack:** C++17, Emscripten Asyncify/JSPI, CMake, Playwright snapshots, Markdown docs.

---

### Task 1: RED Tests

**Files:**
- Create: `tests/A/s11.spec.ts`, `tests/B/s11.spec.ts`, `tests/D/s11.spec.ts`
- Create: `tests/A/s13.spec.ts`, `tests/B/s13.spec.ts`, `tests/D/s13.spec.ts`
- Create: `tests/A/s15.spec.ts`, `tests/B/s15.spec.ts`, `tests/D/s15.spec.ts`
- Create: `tests/A/s16.spec.ts`, `tests/B/s16.spec.ts`, `tests/D/s16.spec.ts`
- Create: `tests/A/s17.spec.ts`, `tests/B/s17.spec.ts`, `tests/D/s17.spec.ts`

- [ ] Add specs that call `runResolveOnlyScenario` with the controlled Promise ids documented in the design.
- [ ] Run `npx playwright test A/s11 B/s11 D/s11 A/s13 B/s13 D/s13 A/s15 B/s15 D/s15 A/s16 B/s16 D/s16 A/s17 B/s17 D/s17 --workers=1`.
- [ ] Confirm the tests fail because the examples do not exist yet.

### Task 2: Scenario Sources and Build Targets

**Files:**
- Create: `src/scenarios/S11.cpp`
- Create: `src/scenarios/S13.cpp`
- Create: `src/scenarios/S15.cpp`
- Create: `src/scenarios/S16.cpp`
- Create: `src/scenarios/S17.cpp`
- Modify: `CMakeLists.txt`
- Create wrapper directories under `examples/A`, `examples/B`, and `examples/D`.

- [ ] Implement S11 as nested `exception_ptr` captured before a suspend and rethrown after it.
- [ ] Implement S13 as a copied concrete exception object that crosses a suspend.
- [ ] Implement S15 as a stable `const char*` payload that crosses a suspend.
- [ ] Implement S16 as a copied `std::string` payload that crosses a suspend.
- [ ] Implement S17 as an `exception_ptr` created after a resume and consumed before any later suspend.
- [ ] Register all five scenarios for A/B/D in `CMakeLists.txt`.
- [ ] Add `build.sh` and `run.sh` wrappers matching existing examples.

### Task 3: Observations, Snapshots, and Docs

**Files:**
- Create: `examples/{A,B,D}/s{11,13,15,16,17}/EXPECT.md`
- Create snapshots under `tests/{A,B,D}/s*.spec.ts-snapshots/`
- Modify: `README.md`
- Modify: `docs/findings.md`
- Modify any existing matrix or draft docs that summarize S1-S17.

- [ ] Run the new tests with `--update-snapshots`.
- [ ] Record actual A/B/D behavior in each EXPECT file.
- [ ] Update documentation to explain why S13/S15/S16/S17 are controls and how S11 relates to S12.

### Task 4: Verification and Commit

**Files:**
- All files touched above.

- [ ] Run the new scenario tests without snapshot updates.
- [ ] Run `npm test`.
- [ ] Inspect `git diff`.
- [ ] Commit the complete experiment batch.
