# Live Exception Edge Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S9, S10, S12, and S14 for A/B/D to further isolate which C++ exception/suspend shapes fail on Asyncify + Wasm EH.

**Architecture:** Reuse the S5-S8 resolution-only pattern. Each new scenario has one shared C++ source under `src/scenarios`, A/B/D CMake targets and example wrappers, Playwright specs that drive controlled Promises by resolve, stable snapshots, and documentation that records actual observations.

**Tech Stack:** C++17, Emscripten Asyncify/JSPI, CMake, Playwright snapshots, Markdown docs.

---

### Task 1: RED Tests

**Files:**
- Create: `tests/{A,B,D}/s9.spec.ts`
- Create: `tests/{A,B,D}/s10.spec.ts`
- Create: `tests/{A,B,D}/s12.spec.ts`
- Create: `tests/{A,B,D}/s14.spec.ts`

- [ ] Add Playwright specs using `runResolveOnlyScenario`.
- [ ] Run `npx playwright test A/s9 A/s10 A/s12 A/s14 B/s9 B/s10 B/s12 B/s14 D/s9 D/s10 D/s12 D/s14 --workers=1`.
- [ ] Confirm RED fails because `examples/<target>/<scenario>/build/index.html` does not exist.

### Task 2: Scenario Sources and Build Surface

**Files:**
- Create: `src/scenarios/S9.cpp`
- Create: `src/scenarios/S10.cpp`
- Create: `src/scenarios/S12.cpp`
- Create: `src/scenarios/S14.cpp`
- Modify: `CMakeLists.txt`
- Create: `examples/{A,B,D}/{s9,s10,s12,s14}/{build.sh,run.sh,EXPECT.md}`

- [ ] S9: throw into catch, call helper chain from catch, suspend in helper.
- [ ] S10: throw triggers destructor, destructor calls helper chain, suspend in helper.
- [ ] S12: catch stores `std::exception_ptr`, suspend after catch, then `std::rethrow_exception`.
- [ ] S14: loop over repeated resolved suspend points, then throw to outer catch.
- [ ] Register only A/B/D CMake targets for these scenarios.
- [ ] Add wrappers that invoke `example_<target>_<scenario>`.

### Task 3: Observe and Document

**Files:**
- Snapshot files under `tests/{A,B,D}/s*.spec.ts-snapshots/`
- Modify: `docs/matrix.md`
- Modify: `docs/findings.md`
- Modify: `docs/design.md`
- Modify: `README.md`
- Modify: `docs/metrics.md`
- Modify: `docs/presentation.md`
- Modify: `docs/background.md`
- Modify: `tests/_repo_contract.spec.ts`

- [ ] Run targeted tests with `--update-snapshots`.
- [ ] Record whether B fails only when live exception state crosses suspend.
- [ ] Update docs to include S9, S10, S12, and S14 in the resolution-only stress set.

### Task 4: Verification and Commit

- [ ] Run targeted verification:

```bash
npx playwright test tests/_repo_contract.spec.ts A/s9 A/s10 A/s12 A/s14 B/s9 B/s10 B/s12 B/s14 D/s9 D/s10 D/s12 D/s14 --workers=1
```

- [ ] Run full verification:

```bash
npm test
```

- [ ] Commit:

```bash
git add CMakeLists.txt README.md docs examples src tests
git commit -m "test: add live exception edge scenarios"
```

## Self-Review

- Spec coverage: covers the four recommended scenarios and keeps scope to A/B/D.
- Placeholder scan: no unresolved placeholders.
- Type consistency: scenario IDs use lowercase `s9`, `s10`, `s12`, `s14`; C++ logs use uppercase `S9`, `S10`, `S12`, `S14`.
