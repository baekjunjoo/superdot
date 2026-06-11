# Super Dot

자연어로 입력한 기능을 DotPad(60×40 이진 촉각 디스플레이)에서 작동 가능한 범위 안에서 즉시 구현해주는 현장 프로토타이핑 도구.

라이브: https://baekjunjoo.github.io/superdot

## 구성

- **Feature Builder** — 자연어 요청을 DotPad 런타임 코드(JS)로 변환. 출력은 항상 60×40 이진 디스플레이가 표현 가능한 범위로 제한.
- **DotPad Simulator** — 60×40 핀 매트릭스. F1–F4 + 좌/우 팬 키(화면 버튼 또는 키보드 1–4, ←→).
- **BLE Driver** — Web Bluetooth로 실기기 DotPad에 같은 프레임을 실시간 전송 (Chrome/Edge, HTTPS).
- **TTS · Event Console** — 음성 안내, 키 이벤트, BLE 진단 로그.
- **Feature Library** — 생성 기능 저장/재실행. localStorage에 영구 저장, JSON 내보내기.

## 설정 (상단 SETUP 버튼)

| 항목 | 설명 |
|---|---|
| Generation API Endpoint | Cloudflare Worker 프록시 URL. 비우면 직접 호출(아티팩트 환경 전용) |
| BLE Service UUID | DotPad GATT 서비스 UUID |
| BLE Characteristic UUID | 쓰기 특성 UUID. 비우면 연결 시 쓰기 가능한 특성 자동 선택 |
| Frame Encoding | `cells`(2×4 점자셀당 1바이트, dot1–8=bit0–7) 또는 `rows`(행 우선 비트팩) — 둘 다 300B |
| Write Mode / Chunk | withResponse 여부 + 청크 크기(20B/180B) |

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

전송 파이프라인: 프레임버퍼 → 2×4 점자셀 인코딩(300B, dot1–8=bit0–7) → hex 600자 → `displayGraphicData()` (라인 분할·전송·ACK는 SDK가 처리). 동일 프레임 중복 전송 자동 생략, 전송 간 최소 200ms 스로틀.

SDK 파일이 없는 환경에서는 raw GATT 폴백으로 동작하며, 이때만 SETUP의 UUID/인코딩/쓰기 설정이 사용됩니다.

## 파일

- `index.html` — 앱 전체 (단일 파일, 빌드 불필요)
- `worker.js` — Anthropic API 프록시 (Cloudflare Workers)
- `DotPadSDK-3.0.0.js` — DotPad 공식 SDK (BLE 연결·전송·키 입력)

---

Dot Inc · Internal prototype
