# 지표 — Phase 3.5

이 문서는 완료된 6×4 correctness matrix의 비용과 error-surface 근거를 기록한다. 아래 숫자는 2026-07-02에 Playwright를 통해 stable Chrome에서 실행한 한 번의 sample run이다. timing 값은 비교 신호이지, 이식 가능한 benchmark 주장이 아니다.

## 재현

```sh
source ./emsdk/emsdk_env.sh
for target in A B C D E Ep; do
  for scenario in s1 s2 s3 s4; do
    ./examples/$target/$scenario/build.sh
  done
done
scripts/collect-size-metrics.sh
npx playwright test tests/_metrics.spec.ts --workers=1
```

`Ep`는 matrix target `E'`의 filesystem-safe 디렉터리 이름이다.

## 빌드 산출물 크기

| Target | Scenario | main.wasm bytes | main.js bytes |
|---|---:|---:|---:|
| A | 1 | 26893 | 43705 |
| A | 2 | 27342 | 43764 |
| A | 3 | 21884 | 42838 |
| A | 4 | 21724 | 42675 |
| B | 1 | 34303 | 36824 |
| B | 2 | 34615 | 36883 |
| B | 3 | 28465 | 36806 |
| B | 4 | 28426 | 36806 |
| C | 1 | 17173 | 36103 |
| C | 2 | 17379 | 36214 |
| C | 3 | 7893 | 31881 |
| C | 4 | 7840 | 31718 |
| D | 1 | 19610 | 29202 |
| D | 2 | 19723 | 29313 |
| D | 3 | 10056 | 25761 |
| D | 4 | 10019 | 25761 |
| E | 1 | 21607 | 33129 |
| E | 2 | 23758 | 33340 |
| E | 3 | 23770 | 33085 |
| E | 4 | 23968 | 33085 |
| E' | 1 | 23952 | 26360 |
| E' | 2 | 25482 | 26408 |
| E' | 3 | 25509 | 26408 |
| E' | 4 | 25567 | 26408 |

크기 해석:

- Asyncify 행 A/B는 suspend 시나리오에서 가장 큰 합산 artifact footprint를 가진다.
- JSPI 행 C/D는 JS glue와 Wasm 크기를 크게 줄이지만, correctness는 여전히 `docs/matrix.md`에 기록된 exception boundary 동작에 달려 있다.
- C++20 coroutine 행 E/E'는 작업을 개발자 소유 glue로 옮긴다. 이 예제들에서 E'의 Wasm 파일은 D보다 크지만, Wasm EH가 JS exception-emulation 지원을 피하므로 생성 JS는 E보다 작다.

## Load-To-Completion Timing

| Target | Scenario | Elapsed ms | Outcome | Error surface |
|---|---:|---:|---|---|
| A | 1 | 41 | done | - |
| A | 2 | 48 | done | - |
| A | 3 | 2056 | observed failure/timeout | S3 |
| A | 4 | 4043 | observed failure/timeout | S4 |
| B | 1 | 42 | done | - |
| B | 2 | 46 | done | - |
| B | 3 | 2041 | observed failure/timeout | S3 |
| B | 4 | 4053 | observed failure/timeout | S4 |
| C | 1 | 2028 | observed failure/timeout | trying to suspend JS frames |
| C | 2 | 2040 | observed failure/timeout | trying to suspend JS frames |
| C | 3 | 2043 | observed failure/timeout | trying to suspend JS frames |
| C | 4 | 4041 | observed failure/timeout | trying to suspend JS frames |
| D | 1 | 32 | done | - |
| D | 2 | 38 | done | - |
| D | 3 | 2038 | observed failure/timeout | S3 |
| D | 4 | 4039 | observed failure/timeout | S4 |
| E | 1 | 39 | done | - |
| E | 2 | 44 | done | - |
| E | 3 | 38 | done | - |
| E | 4 | 44 | done | - |
| E' | 1 | 37 | done | - |
| E' | 2 | 37 | done | - |
| E' | 3 | 36 | done | - |
| E' | 4 | 37 | done | - |

Timing 해석:

- 실패 행은 대체로 설정된 observation timeout만큼 걸린다. 이 숫자는 runtime slowness가 아니라 test-visible failure surface를 측정한다.
- 통과 행은 이 harness에서 수십 ms 안에 끝난다. C++20 coroutine 행 E/E'는 rejected settlement를 `await_resume()`에서 C++ control flow로 변환하므로 S3/S4의 긴 timeout 경로를 피한다.
- S5-S17은 이 Phase 3.5 timing table에 포함하지 않는다. 이들의 Phase 4 snapshot은 다른 종류의 관찰을 기록한다. S5-S7/S9-S12는 B(Asyncify + Wasm EH)가 C++-initiated stress path에 도달한 뒤 `null function` / `unreachable`로 실패함을 보여준다. S13/S15/S16은 `PASS:done`에 도달한 뒤 post-done `unreachable`을 낸다. S8/S14/S17은 exception state가 이후 Asyncify suspend를 건너지 않는 normal control은 B도 완료할 수 있음을 보여준다.

## 대표 Error Surface

| Case | Stable leading surface | Class |
|---|---|---|
| A/S3 | `S3` | rejected async operation escapes as page error |
| C/S1 | `trying to suspend JS frames` | JSPI cannot suspend through this JS frame shape |
| D/S3 | `S3` | rejected JS Promise still does not become C++ catchable |
| D/S4 | `S4` | first rejected await escapes before second await can be driven |
| B/S5-S7, B/S9-S10 | `null function` / `unreachable` | Asyncify + Wasm EH fails when live exception state crosses suspend |
| B/S11-S12 | `null function` / `unreachable` | Captured `exception_ptr` state also fails across suspend before rethrow |
| B/S13, B/S15-S16 | post-done `unreachable` | Copied payloads are readable, but completion is not clean on Asyncify + Wasm EH |
| B/S8, B/S14, B/S17 | - | Asyncify + Wasm EH can complete controls where exception state does not cross a later suspend |

정확한 브라우저 stack trace는 의도적으로 여기에 기록하지 않는다. 비교에는 stable leading message와 class만 사용한다.
