# learn-asyncify

Emscripten에서 **Asyncify + C++ Exception을 같이 쓸 때 발생하는 함정**을 재현·설명하고,
**JSPI / Wasm exception handling / C++20 coroutine** 조합별로 무엇이 개선되고
어떤 경계가 남는지를 비교하는 연구 프로젝트.

> 핵심 주장: Emscripten은 단순한 C++→Wasm 트랜스파일러가 아니라, Wasm이 본래 지원하지
> 않는 코루틴/예외 같은 C++ 런타임 기능을 **JS+바이너리 계측 에뮬레이션 레이어**로 직접
> 구현한 Wasm 런타임 구현체다. 그 두 에뮬레이션이 부딪히는 지점이 본 프로젝트의 주제다.

## 결론 먼저

- JS Promise rejection은 자동으로 C++ `catch`에 들어오지 않는다.
- Asyncify/JSPI/Wasm EH 조합을 바꿔도, JS async settlement를 C++ 예외 의미론으로
  해석하는 경계는 개발자가 명시적으로 설계해야 한다.
- **Asyncify + Wasm EH는 안전한 중간 마이그레이션 경로가 아니다.** JS rejection을
  쓰지 않는 S5-S7 stress에서도 B만 `null function`/`unreachable`로 실패했다.
  다만 S8은 B도 통과하여, 실패 조건은 "여러 yield 뒤 throw" 전반이 아니라
  catch/unwind/rethrow 중 exception state가 살아 있는 suspend 쪽으로 좁혀진다.
- 가장 안정적인 패턴은 JS settlement를 데이터로 받고, Wasm/C++ 재진입 후
  C++ 코드(`await_resume()` 등)에서 직접 `throw`하는 것이다.

## 빠른 시작

```sh
# 1) 툴체인(emsdk 버전 핀)
./scripts/toolchain.sh
source ./emsdk/emsdk_env.sh

# 2) 첫 pitfall 재현 (target A, S3)
(cd examples/A/s3 && ./run.sh)

# 3) 전체 correctness + metrics 검증
npm test

# 4) 빌드 산출물 크기 지표
scripts/collect-size-metrics.sh
```

예제 빌드는 루트 `CMakeLists.txt`가 정의하며, 각 `examples/<target>/<scenario>/build.sh`는 해당 CMake target을 호출하는 wrapper다.

각 예제는 자체 `EXPECT.md`에 예상/실제 결과와 원인 한 단락 설명을 둔다.

## 문서

처음 읽는 순서:

1. 결론: [`docs/findings.md`](docs/findings.md)
2. 관측 결과 매트릭스: [`docs/matrix.md`](docs/matrix.md)
3. 정량 지표: [`docs/metrics.md`](docs/metrics.md)
4. 발표/글 초안: [`docs/presentation.md`](docs/presentation.md)
5. 설계: [`docs/design.md`](docs/design.md)
6. 배경(Wasm 런타임 한계 + Emscripten 에뮬레이션): [`docs/background.md`](docs/background.md)

## 예제 매트릭스

| Target | 코루틴 방식 | Exception 방식 | 한 줄 |
|---|---|---|---|
| A | Asyncify (`ASYNCIFY=1`) | JS exception emulation | 현재 실사용 경로 — pitfall 재현 |
| B | Asyncify | Wasm EH | EH만 표준으로 바꾸는 위험한 중간 경로 — S5-S7 실패, S8 통과 |
| C | JSPI (`ASYNCIFY=2`) | JS exception emulation | 코루틴만 표준으로 바꿨을 때 |
| D | JSPI | Wasm EH | 런타임 표준 둘 다 → 일부 표면 개선, JS rejection 경계는 남음 |
| E | **C++20 coroutine** (에뮬 없음) | JS exception emulation | 코루틴 직접 구현 fallback (현재 브라우저) |
| E' | **C++20 coroutine** (에뮬 없음) | Wasm EH | 코루틴 직접 구현 + 예외 표준 |

기본 매트릭스는 × 4 시나리오 S1(기본) / S2(suspend 후 throw) / S3(suspend 중 throw) / S4(catch 후 재 suspend) = 6×4 = 24 예제.
> target E/E'의 “suspend”는 Asyncify/JSPI와 의미가 다르다 — `co_await`로 caller에게 return 후 JS가 `resume()`으로 재진입. 자세한 것은 `docs/design.md` §1.4–1.5, §2.1 각주 참고.

추가 stress 매트릭스 S5-S8은 A/B/D만 대상으로 한다. Promise는 모두 resolve하고
C++ throw/catch/unwind와 suspend만 섞는다. 관측 결과 S5-S7은 A/D 통과, B 실패이고,
S8은 A/B/D 모두 통과다.

## 시나리오 요약

| Scenario | 대상 | 핵심 질문 |
|---|---|---|
| S1 | A/B/C/D/E/E' | suspend 없이 동기 C++ `throw`가 같은 함수의 `catch`에 잡히는 baseline인가? |
| S2 | A/B/C/D/E/E' | Promise resolve로 resume된 뒤 C++에서 직접 던진 예외가 `catch`에 잡히는가? |
| S3 | A/B/C/D/E/E' | suspended Promise rejection이 C++ `catch`로 들어오는가, 아니면 JS pageerror로 새는가? |
| S4 | A/B/C/D/E/E' | 첫 await rejection을 catch한 뒤 다시 await하는 staged recovery가 가능한가? |
| S5 | A/B/D | C++ throw를 catch한 상태에서 catch 블록 안 suspend/resume이 가능한가? |
| S6 | A/B/D | C++ exception unwind 중 destructor가 suspend/resume해도 unwinding이 유지되는가? |
| S7 | A/B/D | inner catch에서 suspend한 뒤 `throw;` rethrow가 outer catch까지 도달하는가? |
| S8 | A/B/D | 여러 단계 호출 체인에서 각 단계가 yield한 뒤 innermost C++ throw가 outer catch까지 도달하는가? |

## 진행 상태

완료된 실험:

- [x] 설계 문서(`docs/design.md`)
- [x] 툴체인 스크립트와 배경 문서 (Phase 0)
- [x] target A pitfall 재현 (Phase 1)
- [x] target B, C 부분 개선/한계 관측 (Phase 2)
- [x] target D 표준 조합 검증/한계 관측 (Phase 3)
- [x] target E, E' 코루틴 직접 구현/검증 (Phase 2.5)
- [x] 빌드 크기/실행 시간/에러 표면 지표 보강 (Phase 3.5)
- [x] resolution-only C++ exception stress 관측 (Phase 4: S5-S8)
- [ ] 발표/글 산출물 최종 다듬기 (Phase 5)
