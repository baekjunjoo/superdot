# Super Dot

자연어로 입력한 기능을 DotPad(60×40 이진 촉각 디스플레이)에서 작동 가능한 범위 안에서 즉시 구현해주는 현장 프로토타이핑 도구.

라이브: https://baekjunjoo.github.io/superdot

## 구성

- **Feature Builder** — 자연어 요청(텍스트 또는 **음성 입력**)을 DotPad 런타임 코드(JS)로 변환. 출력은 항상 60×40 이진 디스플레이가 표현 가능한 범위로 제한. 생성 실패 시 더 단순한 버전으로 1회 자동 재시도. 빠른 요청 칩 제공.
- **DotPad Simulator** — 그래픽 영역 60×40 핀(300셀) + **점자 텍스트 라인 20셀**을 실기기와 동일한 레이아웃으로 표시. F1–F4 + 좌/우 팬 키(화면 버튼 또는 키보드 1–4, ←→).
- **BLE Driver** — Web Bluetooth로 실기기 DotPad에 같은 프레임을 실시간 전송 (Chrome/Edge, HTTPS).
- **TTS · Event Console** — 음성 안내, 키 이벤트, BLE 진단 로그.
- **Feature Library** — 생성 기능 저장/재실행. localStorage에 영구 저장, JSON 내보내기/가져오기(노트북 간 공유).
- **내장 데모 7종** — 분기 매출 차트 · 주사위 · 촉각 시계 · 가위바위보 · 미로 탈출 · 사인 곡선 · **라이브 점자 자막**. 빠른 칩을 누르면 **API 연결 없이 즉시 로드**되어 오프라인 시연 가능. 모든 데모가 그래픽/텍스트 영역을 분리 사용.
- **라이브 점자 자막** — 마이크로 말하면 그래픽 영역에 멀티라인 점자(8줄×20셀)가 실시간 표시되고 화면이 차면 자동 스크롤. F1 지우기, F2 일시정지. 시청각 중복장애 사용자를 위한 실시간 자막 컨셉.
- **한국 점자 약자·약어 적용** — `dp.text`/`dp.textLine`/`dp.brailleCells`가 「(개정) 한국 점자 규정」 제13~18항을 적용해 변환: ㅏ 생략 약자(가~하, 된소리표 포함), 라임 약자 14종(억·언·얼·연·열·영·옥·온·옹·운·울·은·을·인 — 임의 초성·겹받침 결합), '것/껏', 제14항 모음 제약, '팠' 예외, 제17항(성·썽·정·쩡·청), 약어 7종(그래서·그러나·그러면·그러므로·그런데·그리고·그리하여, 어두 한정). 규정 예문 129건 전수 검증 통과.
- **UEB Grade 2 핵심** — 영문은 통일영어점자 약자 적용: 알파벳/온칸/하위 단어 약자, 온칸·하위 묶음 약자(위치 규칙 포함), 어두 약자(dot 5·45·456 계열, 단어 접두 결합 지원), 어미 묶음 약자(-tion 등 12종), 축어 약 65종, 대문자표. to/into/by/dd/ble/com/ation/ally/o'clock 등 UEB 폐지 약자는 규정대로 제외.
- **한계(검수 권장)** — UEB의 음절 경계 브리징 세부 규칙과 1급 점자 지시기호, 한·영 전환 로마자표 지시기호는 근사 처리/미적용입니다. 정식 영업 자료 출력 전 점역 전문가 검수를 권장합니다. SETUP의 **Braille Grade** 토글로 약자 적용(기본)과 풀어쓰기(g1)를 즉시 전환·비교할 수 있습니다.

## 스펙 엔진 & 4단 파이프라인 (v2.0)

기능은 이제 생성 코드가 아니라 **선언적 스펙**(`{template, params}`)이 기본 단위입니다. 템플릿 카탈로그 11종: `bar_chart` `plot` `dice` `clock` `rps` `maze` `caption` `list_nav` `quiz` `timer` `text_show`. 스펙은 실행 전 검증·보정(클램프)되어 구조적으로 런타임 에러가 없고, 내장 데모 7종도 전부 스펙으로 재정의되었습니다.

요청 처리는 비용 오름차순 4단계로 해소됩니다:

`[T1]` 라이브러리 재사용(0 토큰) → `[T1.5]` 현재 스펙의 숫자 파라미터 즉석 수정 → `[T2]` 로컬 매칭: 한국어 키워드 점수화 + 정규식 파라미터 추출(숫자열·시간·콤마 목록·따옴표 텍스트), 완전 오프라인 — "매출 차트 32 45 28 51", "3분 타이머" 등 → `[T3]` AI 슬롯 채우기: 템플릿+파라미터 JSON만 반환하는 저토큰 호출(기존 코드젠 대비 약 1/10) → `[T4]` 코드 생성 폴백(정말 새로운 메커니즘만, 자동 재시도 포함).

채팅 로그에 각 응답의 처리 단계(`[T1]`~`[T4]`)가 표시되어 시연 중 AI 의존도를 그대로 보여줄 수 있습니다. 오프라인에서는 T1/T1.5/T2가 동작합니다.

- **연속 음성 인식 API** — `dp.listen(fn)` / `dp.stopListen()`. 생성되는 기능들도 음성 입력을 활용 가능(Chrome 계열).
- **TTS 음소거** — 전시장 등 소음 환경용 토글(콘솔 헤더). 음성은 꺼져도 시각 로그는 유지.

## 설정 (상단 SETUP 버튼)

| 항목 | 설명 |
|---|---|
| Generation API Endpoint | Cloudflare Worker 프록시 URL. 비우면 직접 호출(아티팩트 환경 전용) |
| BLE Service UUID | DotPad GATT 서비스 UUID |
| BLE Characteristic UUID | 쓰기 특성 UUID. 비우면 연결 시 쓰기 가능한 특성 자동 선택 |
| Frame Encoding | `cells`(DotPad 표준: 열 순차 bit0–7) / `braille`(점자 도트 순, 비교용) / `rows`(행 우선, raw 전용) |
| Write Mode / Chunk | withResponse 여부 + 청크 크기(20B/180B) |
| Braille Engine | `내장`(기본·오프라인·즉시) / `Liblouis`(정밀·역점역, `liblouis/` 빌드 필요) |

## Liblouis 옵션 엔진 (정밀 점역 · 역점역)

자체 변환기(개정 한국 점자 규정 예문 129건 전수 통과 + UEB G2 핵심)가 기본이며, [liblouis](https://github.com/liblouis/liblouis)를 옵션 정밀 엔진으로 얹을 수 있습니다.

- **동작 방식**: 모든 점자 출력은 내장 변환기로 *즉시* 렌더 → liblouis 결과가 워커에서 도착하면 같은 화면일 때만 업그레이드. liblouis가 실패하는 단어는 자동으로 내장 결과 유지(시연이 절대 멈추지 않음).
- **활성화**: `liblouis/build-no-tables-utf16.js`를 직접 빌드해 넣고(동봉된 `liblouis-빌드가이드.md` 참고) SETUP → Braille Engine → Liblouis. `easy-api.js`와 최신 테이블 23종(ko-g1/g2, en-ueb-g1/g2 + include)은 저장소에 포함되어 있습니다.
- **npm 공식 브라우저 빌드(3.2, 2017)를 쓰지 않는 이유**: '것이다'·'working' 등에서 변환 크래시, 한국어 역점역 손상, '팠다' 제14항 위반(구규칙). 최신 빌드 전까지는 내장 엔진이 더 정확하고 안전합니다.
- **점역 테스트 패널**: SETUP 안에서 내장 vs Liblouis 점형·역점역을 즉석 비교할 수 있습니다(점역 검수 도구 겸용).
- 언어는 자동 선택됩니다: 한글 포함 → `ko-g1/g2`, 그 외 → `en-ueb-g1/g2` (SETUP의 점자 등급과 연동).

## 생성 API 프록시 (필수 — 배포 환경)

GitHub Pages에서는 Anthropic API를 직접 호출할 수 없습니다(키 노출·CORS). 동봉된 `worker.js`를 Cloudflare Workers에 배포하세요:

1. dash.cloudflare.com → Workers & Pages → Create Worker → `worker.js` 내용 붙여넣고 Deploy
2. Worker Settings → Variables → **Secrets**: `ANTHROPIC_API_KEY` 추가, (선택) `ALLOWED_ORIGIN=https://baekjunjoo.github.io`
3. Worker URL을 사이트 SETUP → Generation API Endpoint에 입력

## 실기기 BLE 연동 (공식 DotPadSDK)

저장소 루트에 `DotPadSDK-3.0.0.js`를 두면(이 저장소에 포함됨) BLE CONNECT 시 공식 SDK로 연결됩니다:

1. 상단 **BLE CONNECT** → 기기 선택 (SDK가 `DOTPAD` 이름으로 필터 스캔)
2. 연결되면 배지가 `LIVE · DOTPAD`로 바뀌고, 시뮬레이터에 그려지는 모든 프레임이 기기로 동시 전송됨
3. **실기기 하드웨어 키가 기능을 직접 조작** — F1–F4, 팬 좌/우가 SDK 키 콜백으로 들어와 현재 로드된 기능의 `dp.onKey`로 전달됨 (콘솔에 `[KEY·HW]`로 표시)

전송 파이프라인: 프레임버퍼 → 그래픽 셀 인코딩(300B, 셀 내 좌열 위→아래 bit0–3 / 우열 위→아래 bit4–7) → hex 600자 → `displayGraphicData()` (라인 분할·전송·ACK는 SDK가 처리). 동일 프레임 중복 전송 자동 생략, 전송 간 최소 200ms 스로틀.

텍스트 라인은 `dp.textLine(str)` → 20셀 점자(hex 40자) → `displayTextData()`로 전송됩니다(셀 바이트 = dot1–8 = bit0–7).

시뮬레이터 헤더의 **SYNC TEST** 버튼으로 정렬 검증 패턴(테두리·대각선·L 마커·중앙 원·텍스트 라인)을 띄워 기기와 1:1 일치 여부를 확인할 수 있습니다.

SDK 파일이 없는 환경에서는 raw GATT 폴백으로 동작하며, 이때만 SETUP의 UUID/인코딩/쓰기 설정이 사용됩니다.

## 파일

- `index.html` — 앱 전체 (단일 파일, 빌드 불필요)
- `worker.js` — Anthropic API 프록시 (Cloudflare Workers)
- `DotPadSDK-3.0.0.js` — DotPad 공식 SDK (BLE 연결·전송·키 입력)
- `liblouis/easy-api.js` — liblouis-js 워커 래퍼 (포함)
- `liblouis/tables/` — liblouis master 기준 ko/en-ueb 테이블 + include 23종 (포함)
- `liblouis/build-no-tables-utf16.js` — 직접 빌드해서 추가 (→ `liblouis-빌드가이드.md`)
- `liblouis-빌드가이드.md` — 최신 liblouis WASM 빌드·검증 가이드

---

Dot Inc · Internal prototype
