# Phase 3.5 Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducible cost and surface-area metrics after the completed correctness matrix.

**Architecture:** Keep metrics separate from correctness tests. Reuse existing `examples/<target>/s<n>/build.sh` outputs, collect artifact sizes with a shell script, collect browser timing/pageerror surfaces with a dedicated Playwright metrics spec, and record the generated observations in `docs/metrics.md`.

**Tech Stack:** Emscripten build outputs, POSIX shell, Playwright, Markdown tables.

---

## Scope

Phase 3.5 measures the existing 6×4 examples. It does not change scenario behavior, correctness snapshots, compiler flags, or the main Playwright assertions.

## Planned Artifacts

- `scripts/collect-size-metrics.sh`: builds or inspects all examples and prints `target,scenario,main.wasm bytes,main.js bytes`.
- `tests/_metrics.spec.ts`: loads each example page, waits for the existing PASS/FAIL/timeout observation boundary, and records load-to-completion timing plus representative pageerror text.
- `docs/metrics.md`: stores the measured tables and a short interpretation.
- `docs/findings.md`: links the metrics interpretation back to the final research summary.
- `README.md`: links `docs/metrics.md` once the metrics document exists.

## Task 1: Size Metrics

- [x] Create `scripts/collect-size-metrics.sh`.
- [x] Ensure the script fails clearly when an expected `build/main.wasm` or `build/main.js` is missing.
- [x] Run all example build scripts under `source ./emsdk/emsdk_env.sh`.
- [x] Run the size metrics script and paste the resulting table into `docs/metrics.md`.

## Task 2: Browser Timing Metrics

- [x] Create `tests/_metrics.spec.ts` as a separate non-snapshot metrics test.
- [x] Load all examples through the same `http://localhost:8080/examples/<target>/s<n>/build/index.html` URLs.
- [x] Wait for deterministic console end markers when present; for known failure/hang scenarios, use the existing timeout boundary.
- [x] Record timing as comparative evidence, not as a strict pass/fail threshold.

## Task 3: Error Surface Metrics

- [x] Capture representative `pageerror` messages for A/S3, C/S1, D/S3, and D/S4.
- [x] Avoid overfitting to full browser stack traces; record the stable leading message and failure class.
- [x] Add a compact table to `docs/metrics.md`.

## Task 4: Documentation Integration

- [x] Add `docs/metrics.md` to README's document list.
- [x] Add a short Phase 3.5 interpretation to `docs/findings.md`.
- [x] Keep detailed raw measurements in `docs/metrics.md`, not in `docs/findings.md`.

## Verification

- [ ] Run `source ./emsdk/emsdk_env.sh && npx playwright test --workers=1`.
- [ ] Run `scripts/collect-size-metrics.sh`.
- [ ] Confirm `git status --short` excludes generated build artifacts and `test-results/`.
