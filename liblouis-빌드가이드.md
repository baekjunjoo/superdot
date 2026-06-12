# Liblouis 최신 빌드 가이드 — Super Dot 정밀 점역 엔진 활성화

Super Dot에는 Liblouis 연동 코드가 이미 내장되어 있습니다. **빌드 산출물 1개 파일**(`build-no-tables-utf16.js`)만 `liblouis/` 폴더에 넣으면 SETUP → Braille Engine → Liblouis 선택으로 켜집니다. 나머지(easy-api.js, 최신 테이블 23종)는 이미 저장소에 포함되어 있습니다.

```
superdot/
├── index.html
├── liblouis/
│   ├── easy-api.js                  ✅ 포함됨 (liblouis-js 0.4.0)
│   ├── build-no-tables-utf16.js     ❗ 이 파일을 직접 빌드해서 넣기 (이 가이드의 목적)
│   └── tables/                      ✅ 포함됨 (GitHub master 기준 ko/en-ueb + include 23개)
```

## 왜 직접 빌드하나

npm에 올라온 공식 브라우저 빌드(`liblouis-build`)는 **2017년 liblouis 3.2**에서 멈춰 있습니다. 이 구버전은 '것이다'·'깜깜하다'·'working' 같은 단어에서 변환이 죽고, 한국어 역점역이 깨져 있습니다. 최신 liblouis(3.28+)를 emscripten으로 직접 빌드하면 최신 테이블과 함께 정상 동작합니다.

> 참고: 한국어 점역 자체는 자체 변환기가 개정 규정 기준으로 더 정확한 부분이 있습니다(예: '팠다' 제14항 — liblouis 테이블은 master에도 `팠 145-34` 구규칙이 남아 있음). Liblouis의 가치는 **영어 UEB 정밀도 + 역점역 + 문장부호 롱테일**이며, Super Dot은 Liblouis 실패 시 항상 내장 변환기로 자동 폴백합니다.

---

## 0. 동작 확인용 스모크 테스트 (빌드 전, 5분)

먼저 구버전 빌드로 **연동 파이프라인 자체**가 도는지 확인할 수 있습니다(한계는 위와 같으니 확인 후 교체).

```bash
cd <임시폴더>
npm i liblouis-build
cp node_modules/liblouis-build/build-no-tables-utf16.js <superdot>/liblouis/

# 로컬 서빙 (file:// 불가 — 워커 사용)
cd <superdot> && npx serve .
```

브라우저에서 SETUP → Braille Engine → **Liblouis** 저장 → 상태가 `사용 중 (v3.2.0)`이 되면 파이프라인 정상. 점역 테스트에 `안녕`을 넣어 내장과 일치하는지 확인하세요. 확인 후 아래 최신 빌드로 교체합니다.

---

## 1. 빌드 환경 준비 (macOS / Linux / WSL)

```bash
# 필수 도구
# macOS:  brew install autoconf automake libtool pkg-config git python3
# Ubuntu: sudo apt install autoconf automake libtool pkg-config git python3 build-essential

# emscripten SDK
git clone https://github.com/emscripten-core/emsdk
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh        # 새 터미널마다 필요
emcc -v                      # 버전 출력되면 OK
```

## 2. liblouis 최신 소스 빌드

```bash
git clone https://github.com/liblouis/liblouis
cd liblouis
./autogen.sh
emconfigure ./configure --disable-shared CFLAGS='-O2'
#   (기본 widechar=UTF-16 → easy-api의 utf16 모드와 일치. --enable-ucs4는 켜지 마세요)
emmake make
ls .libs/liblouis.a          # 정적 라이브러리 생성 확인
```

## 3. 브라우저용 JS로 링크

easy-api.js가 기대하는 export 목록 그대로 내보냅니다. 아래를 `build.sh`로 저장 후 liblouis 소스 루트에서 실행:

```bash
#!/bin/bash
EXPORTS='["_lou_version","_lou_translateString","_lou_translate","_lou_backTranslateString","_lou_backTranslate","_lou_charSize","_lou_checkTable","_lou_getTable","_lou_findTable","_lou_compileString","_lou_setDataPath","_lou_getDataPath","_lou_setLogLevel","_lou_registerLogCallback","_lou_logEnd","_lou_free","_lou_charToDots","_lou_dotsToChar","_lou_getTypeformForEmphClass","_lou_getEmphClasses","_lou_hyphenate","_lou_resolveTable","_lou_indexTables","_lou_allocMem","_free","_malloc"]'

emcc .libs/liblouis.a -O2 \
  -s WASM=0 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s FORCE_FILESYSTEM=1 \
  -s ENVIRONMENT=worker,node \
  -s EXPORTED_FUNCTIONS="$EXPORTS" \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","FS","stringToUTF16","UTF16ToString","UTF8ToString","getValue","setValue"]' \
  -o build-no-tables-utf16.js
```

핵심 플래그 설명:
- `-s WASM=0` — wasm2js 출력. **동기 초기화**라서 easy-api(구식 동기 가정)와 레이스 없이 호환됩니다. 속도는 충분합니다(점역은 ms 단위).
- `-s FORCE_FILESYSTEM=1` — 테이블 지연 로딩(`FS.createLazyFile`)에 필수.
- `-s ENVIRONMENT=worker,node` — Super Dot은 웹 워커에서 구동합니다.

> `-s WASM=1 -s SINGLE_FILE=1`로 진짜 WASM 빌드도 가능하지만, 초기화가 비동기가 되어 easy-api와 레이스가 날 수 있습니다. 그 경우 easy-api 워커 init에서 `Module.onRuntimeInitialized`를 기다리는 패치가 필요하므로, 우선 `WASM=0`을 권장합니다.

## 4. 배치 및 활성화

```bash
cp build-no-tables-utf16.js <superdot>/liblouis/
cd <superdot> && git add liblouis && git commit -m "liblouis 최신 빌드 추가" && git push
```

GitHub Pages 반영 후(또는 로컬 `npx serve .`):
1. SETUP → **Braille Engine: Liblouis** → 저장
2. 상태줄이 `Liblouis: 사용 중 (v3.x.x)`인지 확인
3. 현재 기능이 자동 재로드되며, 이후 모든 점자 출력은 *내장 즉시 표시 → liblouis 도착 시 업그레이드* 순으로 동작

## 5. 검증 체크리스트 (점역 테스트 패널)

SETUP의 점역 테스트에 입력해 비교하세요. dots 표기는 `점번호|점번호|...`입니다.

| 입력 | 기대 (개정 규정) | 확인 포인트 |
|---|---|---|
| 안녕 | 126\|25\|14\|12456 | 내장·liblouis 일치해야 함 |
| 팠다 | 145\|**126**\|34\|24 | liblouis가 145\|34\|24면 테이블 구규칙(제14항 위반) — 내장이 정답 |
| 것이다 | 456\|234\|12345\|24 | 구버전 빌드는 여기서 죽음 → 최신 빌드 정상 여부 핵심 지표 |
| working | UEB: work+ing | 구버전 크래시 단어 |
| 역점역 | 입력 복원 | 한국어 역점역이 복원되면 최신 빌드 성공 |

크래시·불일치 단어가 있어도 실사용에는 지장 없습니다 — 해당 단어만 내장 변환기로 자동 폴백되고 콘솔에 debug 로그가 남습니다.

## 트러블슈팅

- **상태가 "초기화 시간 초과"** → `liblouis/build-no-tables-utf16.js`가 없거나 경로가 다름. 네트워크 탭에서 404 확인.
- **"file:// 에서는 동작하지 않습니다"** → `npx serve .` 등으로 http 서빙. GitHub Pages는 문제 없음.
- **테이블 에러가 콘솔에 가득** → 엔진과 테이블 버전 불일치(구 엔진 + 신 테이블은 불가). 최신 엔진을 빌드했는지 확인.
- **emconfigure에서 yaml 관련 에러** → `./configure --disable-shared --without-yaml` 추가 (테스트용 의존성이라 빼도 무방).
