# learn-asyncify

Emscripten에서 **Asyncify + C++ Exception을 같이 쓸 때 발생하는 함정**을 재현·설명하고,
표준화된 **JSPI + Wasm exception handling** 조합이 이를 어떻게 해소하는지를 보이는 연구 프로젝트.

> 핵심 주장: Emscripten은 단순한 C++→Wasm 트랜스파일러가 아니라, Wasm이 본래 지원하지
> 않는 코루틴/예외 같은 C++ 런타임 기능을 **JS+바이너리 계측 에뮬레이션 레이어**로 직접
> 구현한 Wasm 런타임 구현체다. 그 두 에뮬레이션이 부딪히는 지점이 본 프로젝트의 주제다.

## 빠른 시작

```sh
# 1) 툴체인(emsdk 버전 핀)
./scripts/toolchain.sh

# 2) 첫 pitfall 재현 (target A, S2)
cd examples/A/s2 && ./build.sh && ./run.sh
```

각 예제는 자체 `EXPECT.md`에 예상/실제 결과와 원인 한 단락 설명을 둔다.

## 문서

- 설계: [`docs/design.md`](docs/design.md)
- 배경(Wasm 런타임 한계 + Emscripten 에뮬레이션): [`docs/background.md`](docs/background.md)
- 관측 결과 매트릭스: [`docs/matrix.md`](docs/matrix.md)
- 정량 지표: [`docs/metrics.md`](docs/metrics.md)
- 결론: [`docs/findings.md`](docs/findings.md)

## 예제 매트릭스

| Target | 코루틴 방식 | Exception 방식 | 한 줄 |
|---|---|---|---|
| A | Asyncify (`ASYNCIFY=1`) | JS exception emulation | 현재 실사용 경로 — pitfall 재현 |
| B | Asyncify | Wasm EH | EH만 표준으로 바꿨을 때 부분 개선 |
| C | JSPI (`ASYNCIFY=2`) | JS exception emulation | 코루틴만 표준으로 바꿨을 때 |
| D | JSPI | Wasm EH | 런타임 표준 둘 다 → 충돌 해소 |
| E | **C++20 coroutine** (에뮬 없음) | JS exception emulation | 코루틴 직접 구현 fallback (현재 브라우저) |
| E' | **C++20 coroutine** (에뮬 없음) | Wasm EH | 코루틴 직접 구현 + 예외 표준 |

× 4 시나리오 S1(기본) / S2(suspend 후 throw) / S3(suspend 중 throw) / S4(catch 후 재 suspend) = 6×4 = 24 예제.
> target E/E'의 “suspend”는 Asyncify/JSPI와 의미가 다르다 — `co_await`로 caller에게 return 후 JS가 `resume()`으로 재진입. 자세한 것은 `docs/design.md` §1.4–1.5, §2.1 각주 참고.

## 진행 상태

- [x] 설계 문서(`docs/design.md`)
- [x] 툴체인 스크립트와 배경 문서 (Phase 0)
- [x] target A pitfall 재현 (Phase 1)
- [x] target B, C 부분 개선/한계 관측 (Phase 2)
- [x] target D 표준 조합 검증/한계 관측 (Phase 3)
- [x] target E, E' 코루틴 직접 구현/검증 (Phase 2.5)
- [x] 빌드 크기/실행 시간/에러 표면 지표 보강 (Phase 3.5)
