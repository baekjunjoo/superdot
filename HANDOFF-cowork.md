# Super Dot — Cowork 작업 인계 문서 (HANDOFF v2)

> **이어받는 Claude에게**: 이 프로젝트를 손대기 전에 이 문서를 먼저 읽으세요. "불변 항목(§4)"은 실기기·규정으로 검증된 값/동작이라 정리·리팩토링 중에도 의미가 바뀌면 안 됩니다. **동작 보존이 최우선**입니다. 이 zip의 `index.html`이 최신 진본입니다(아래 §3 상태 참고).

---

## 1. 프로젝트가 무엇인가
- **Super Dot**: 시각장애인용 촉각 디스플레이 **DotPad**(60×40 이진 점자 그래픽 300셀 + 점자 텍스트 라인 20셀, 키 F1~F4·팬 좌/우, TTS, 마이크)에서, 자연어로 요청한 기능을 그 자리에서 만들어 시연하는 도구.
- 배포: `https://baekjunjoo.github.io/superdot` (GitHub Pages, 저장소 `baekjunjoo/superdot`, 브랜치 `main`).
- 만든 사람: Dot Inc. 공동창업자·디자인 디렉터.

## 2. 파일 구성
- `index.html` — **앱 전체 (단일 파일, 약 2,900줄 JS + CSS 인라인)**. 본체.
- `super-dot.html` — index.html의 동일 사본. **index.html을 고치면 항상 `cp index.html super-dot.html`.**
- `DotPadSDK-3.0.0.js` — DotPad 공식 SDK(BLE·전송·키). **수정 금지**. (다중 기기 지원: 내부에 `#se` 컬렉션·`getConnectedDevices()`, `connectBleDevice`/`disconnect`/`displayLineData`가 dev 인자를 받음.)
- `worker.js` — Cloudflare Workers Anthropic API 프록시(자유 기능 생성용).
- `worker-nim.js` — **NVIDIA NIM 통합 프록시 샘플**(신규). `/asr`(+선택적 Maxine 잡음제거)·`/translate` 라우팅. 키 1개(NVIDIA_API_KEY)로 동작. 엔드포인트 상수는 모델 문서에 맞춰 확인 필요.
- `liblouis-빌드가이드.md` — 옵션 점역 엔진 빌드 가이드(자산 미포함).
- `README.md`, `superdot-nvidia-후보.md`(NVIDIA 적용 후보 정리), 그리고 이 `HANDOFF-cowork.md`.

## 3. 배포 & 커밋 방법 / 현재 상태
- GitHub Pages는 빌드 없이 정적 서빙. 앱 로직은 **단일 index.html** 유지가 원칙(§4-5).
- 커밋: GitHub 웹 "Add file → Upload files"로 index.html 업로드 후 커밋.
- ⚠️ **이번 세션 주의**: 브라우저 자동화로 커밋 버튼 클릭이 자주 실패했고(브리지 불안정), 사용자가 직접 "Commit changes"를 눌러 반영해 왔습니다. 반영 후엔 `git clone --depth 1`로 바이트 대조 검증을 습관화하세요.
- **현재 저장소 HEAD ≈ `559f10b`(리팩토링)**. 그 뒤 **접근성 aria 수정 1건이 미커밋 상태일 수 있음** → **이 zip의 index.html이 최신 진본**이니 여기서 이어가세요.

## 4. ⚠️ 불변 항목 — 의미를 바꾸지 말 것 (실기기·규정 검증)
1. **그래픽 셀 인코딩**: `bit = y%4 + (x%2)*4`. 실기기 검증값.
2. **텍스트 셀 인코딩**: `dotsToByte` = dot1~8 → bit0~7. (유니코드 점자 문자 = `0x2800 + dotsToByte(cell)` — eBraille 내보내기에서 사용.)
3. **BLE 전송**: 그래픽·텍스트 모두 **행 단위 `displayLineData`(LIVE)** 로만. `displayGraphicData` 전체 전송으로 되돌리지 말 것(윗줄 무한 리프레시 재발). **keep-alive(1초 동일 1행 재전송)** 유지.
4. **BoardInfo 동기화**: `onMessage 'Connected'` 후에만 전송 시작.
5. **점자 변환 테이블**(`brailleCells`, `KCHO/KJUNG/KJONG`, `KR_A`, `KR_RIME`, `EN_WORD` 등): 개정 한국 점자 129건 + UEB G2 검증. **값 수정 금지**.
6. **단일 파일 배포**: 앱 로직을 여러 .js로 분리하면 배포가 깨짐(빌드 없음). SDK·worker·liblouis는 별도 파일 OK(기존 패턴).
7. **localStorage**(`sd_cfg`, `sd_lib`, `sd_lang`, `sd_memo`(음성 메모), `sd_minutes`(회의록 자동 보존), `sd_miss`(미매칭 로그·최근 100), `sd_learn`(T3 슬롯필 학습·최대 200), `sd_wrong`(퀴즈 오답 노트·최대 50))는 배포본에서 정상 — 그대로 둘 것.
8. **[신규] 다중 기기 미러링**: BLE는 `BLE.devs[]` 배열 + 공용 `_capture()` 로 관리. 캡처/전송은 **기기별 fan-out**(pump가 기기별 `lastSent`로 행 차분), 전송 간격 = `MIN_INTERVAL × 기기수`(대역폭 보호). **단일 `BLE.dev`로 되돌리지 말 것.** 최대 5대(`BLE.MAX`).
9. **[신규] 페이지 방식 렌더**: 라이브 자막·회의록 실시간 표시는 `drawBrailleBlock(dp,s,{page:true})`. **줄 스크롤로 되돌리면 "줄 넘길 때마다 전체 리프레시" 문제 재발.**
10. **[신규] TTS 문장 언어 자동 감지**: `detectTextLang`/`pickVoiceFor` — 한글/영문에 따라 음성 자동 선택, 언어별 음성 캐시(같은 언어 내 교체 방지). 유지.
11. **[신규] eBraille(.ebrl) 유효성**: 순수 JS OCF ZIP(`zipStore`/`crc32`). `mimetype`은 **STORED(무압축)·첫 항목**, 내용 `application/epub+zip`. `META-INF/container.xml` rootfile media-type `application/oebps-package+xml`. `package.opf` 필수 메타 13종(특히 `dc:format`=`eBraille 1.0`, `dc:language`에 `Brai` 서브태그, `a11y:*`). 본문은 **유니코드 점자(U+2800)**. 라이브러리 번들 없음 — 유지.
12. **[신규] 숨김 기능**: `weather / coord_plane / graph_explore / map / xlate / doc` 는 **TEMPLATES + MATCH_RULES + KEYMAP만** 등록(칩·`library.push` 없음) → 자연어로만 호출되는 **의도된 비노출**. 칩으로 노출하지 말 것.
13. **[신규] NVIDIA/온디바이스 기능은 설정 게이트**: 기본값 오프라인(`SD.cfg.asr='web'`, `nimApi` 없음). 미설정/실패 시 반드시 폴백. `nimBase()`·프록시 계약(`/asr`,`/translate`) 유지. 접근성 aria 속성(§아키텍처) 제거 금지.

## 5. 아키텍처 핵심
- **스펙 엔진**: 기능 = 선언적 스펙 `{template, params}`. `TEMPLATES`(약 23종)가 검증 런타임, `runSpec` 실행.
- **템플릿 목록(발췌)**: bar_chart, plot, dice, clock, rps, maze, timer, caption, **minutes**, list_nav, quiz, vocab, braille_learn, number_line, fraction, picker, text_show, **weather, coord_plane, graph_explore, map, xlate, doc**(뒤 6종은 숨김), **shape(도형), calc(계산기), memo(음성 메모·sd_memo 유지), braille_doc(파일 열기 전용 점자 원문 뷰어 — MATCH_RULES 없음), timetable(주간 시간표 격자), checklist(체크리스트), convert(단위 변환), catalog(기능 카탈로그 — 숨김 6종은 목록에서 의도적 제외)**.
- **4단 생성 파이프라인**(`generate`): T1 라이브러리 재사용 → T1.5 즉석 수정 → **T2 로컬 매칭**(`localMatch`+`MATCH_RULES`) → T3 AI 슬롯필 → T4 AI 코드젠.
- **i18n**(ko/en): `I18N` 사전 + `data-i18n` + `applyLang()`. 라이브러리 항목도 언어 반영(`fName`/`fDesc`, 데모의 `nameEn`/`descEn`). 동적 메시지 `t(key)`, 템플릿 음성 `dp.L(ko,en)`.
- **ASR 3엔진**(`dp.listen` 라우팅): `web`(브라우저 Web Speech, 기본) / `whisper`(온디바이스, transformers.js CDN 지연로드, `whisperLoad`) / `nvidia`(프록시). 캡처는 공용 `dp._capture(onSegment,isWhisper)`(getUserMedia 잡음제거 → ~4초 구간 → onSegment), `setListenLang`으로 재시작, 실패 시 `_startRecog` 폴백. F3 = 한/영 인식 전환.
- **번역**(xlate): `odTranslate`(크롬 내장 Translator) → 없으면 `{nimApi}/translate` → 없으면 Anthropic.
- **TTS**: `detectTextLang`→`pickVoiceFor` 언어별 음성, 마이크 활성 시 음량 자동 보정(`ttsVol`).
- **BLE**: `BLE.devs[]`, `_capture`(공용), `pump`(기기별 행 차분·간격 보호), `startKeepalive`(전 기기), `_stopNim`. 단일=`_startNimAsr` 게이트, raw 폴백 존재.
- **회의록 저장**: `SD.cfg.minutesFmt` = txt/md/csv/html/json/**ebrl**(`buildEbrl`). SETUP에서 선택.
- **접근성**: skip 링크, `:focus-visible` 전역, `aria-live`(ttsLog·chatLog·기기목록), 아이콘 버튼 aria-label, 캔버스 role/label. 제거 금지.

## 6. ✅ 안전한 리팩토링 절차 (반드시 이 순서)
1. **기준선 스냅샷**: 변경 전 ① 인라인 `<script>` 추출 → `node --check` ② 매처 **38개 대표 발화** 출력 스냅샷 ③ 기능 마커 grep 카운트.
2. **작게 변경**(한 종류씩).
3. 변경마다 **`node --check`**.
4. **기준선 대조**: 매처 38발화 전후 **완전 동일**(template/score/needAI), 마커 유지.
5. **mock `dp`** 로 관련 템플릿·`_capture`·저장/번역 경로 실행 → 에러 0.
6. **`cp index.html super-dot.html`**, 배포가 **단일 index.html** 인지 확인.
7. clone 후 바이트 대조.

## 7. 검증 스니펫
```bash
# 인라인 스크립트 추출 후 구문 검사
python3 -c "import re;h=open('index.html').read();s=re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>',h,re.S)[0];open('/tmp/app.js','w').write(s)"
node --check /tmp/app.js
```
- 매처: `MATCH_RULES`,`extractItems`,`localMatch`(+`shuffle`/`quizFromRows`/`EDU_*` 스텁)를 추출해 대표 발화 38건으로 `{template,score,needAI}` 스냅샷 후 전후 대조.
- 템플릿/캡처: `TEMPLATES`, `drawBrailleBlock`, `dotsToByte`, `DOT_POS`, eBraille 헬퍼(`zipStore`/`buildEbrl`) 등을 mock `dp`로 실행(브라우저 전용 API는 스텁).

## 8. 남은 작업 / 후보
- **한국어 ASR 품질**: F3를 Whisper 언어 힌트로 연결 + SETUP에 Whisper 모델(tiny/base) 선택(다운로드↑). (현재 영어 우선이라 tiny·자동으로 충분.)
- **OCR→점자 / VLM 이미지·차트 설명**: 같은 NIM 프록시에 경로 추가 또는 Tesseract.js/transformers.js 온디바이스.
- **접근성**: 라이브에서 Lighthouse/axe 스캔으로 수치 확인, 혼합 언어 구간 `lang` 태깅.
- **회의록 PDF/DOCX**: PDF는 브라우저 인쇄(Save as PDF)가 한글 폰트 부담 없이 유리(라이브러리 번들 회피).

## 9. 2026-07-02 세션 변경 요약 (Cowork)
- **버그 수정**: ①LANG/SD/AI_MODEL 스크립트 최상단 이동(부팅 오프라인 안내 복구) ②SHARE 필터 request/이름 판정(회의록 데모 유출 수정) ③quiz busy 가드 ④raw BLE 재연결 시 서비스 재탐색+상태 복구 ⑤부팅 자동 실행 게이트(마이크 시작·미승인 외부 code 기능 제외).
- **보안**: IMPORT/공유 링크 code 기능 `foreign` 표시 → 첫 실행 전 confirm(`FOREIGN_OK`, 세션 단위).
- **접근성·i18n**: SETUP 모달 포커스 트랩/복귀, 전역 키 핸들러 SELECT·모달·수정자 키 가드, SETUP 전체·BLE 로그 data-i18n/`tt()` 영어화, `data-i18n-aria` 지원.
- **회의록 기본 저장 형식 = ebrl** (`SD.cfg.minutesFmt` 폴백 및 SETUP 초기값).
- **신규 기능**: `shape`(정다각형/원 촉각 탐색), `calc`(음성 계산기, 정규식 정제 후 Function 평가), `memo`(음성 메모, `sd_memo` 유지, 공용 `saveTranscript` 사용 — minutes save에서 추출), `braille_doc`+OPEN 버튼(`zipReadStored`로 STORED eBraille 열람, F1 음성은 Liblouis 역점역), **교실 모드**(`BLE.classroom` — 1번 기기만 하드웨어 키 허용, 기기 목록 토글). 칩 3개(계산기/도형 탐색/음성 메모, 라이브러리 미푸시 `CALCF/SHAPEF/MEMOF`).
- 검증: 기존 매처 40발화 스냅샷 전후 동일, 신규 매칭 12발화 확인, mock 스모크(템플릿 27종·ebrl 왕복·교실 라우팅) 통과.
- **NVDA 대응**: SETUP 12필드 label-for 연결, ttsBtn aria-pressed, 부팅 시 스크린리더 안내 1줄(TTS OFF 시 콘솔 라이브 리전으로만 낭독).
- **비시각 사용성(워크스루 기반)**: ①로드 후 무음 감지 — `tts._n` 카운터로 loadFeature가 "런타임이 아무 말도 안 한 로드"(구형 템플릿 T2/RUN/카탈로그)를 감지해 `CATALOG_LIST` 표시명+`keymapGuide()`(KEYMAP→음성 키 안내)를 자동 발화. 인트로 있는 기능·speakIntro=false 부팅 로드는 미발화. ②minutes 복구를 자체 TTS로도 안내(700ms 지연), F4 삭제는 4초 내 2회 확인. ③quiz 피드백 중 입력에 "잠시만요" 응답.
- **EN 모드 발화 전수 스윕(자동화)**: 전 템플릿×전 키 실행 후 발화에서 한글 정규식 검출 — 29건 발견·수정: ①rps 이름, F3 언어 전환 안내(caption/minutes/memo/xlate), braille_learn 점 번호 낭독 dp.L화 ②EN 모드 기본 샘플 콘텐츠 — defaults **참조 동일성**(p.items===TEMPLATES.x.defaults.items)으로 "기본값 그대로 로드"를 감지해 영어 샘플로 교체(list_nav/quiz/text_show/doc/timetable/checklist/vocab), braille_learn은 defaults.mode=null+LANG 지연 결정(en=alpha) ③"학습 삭제/learn clear" 명령(오염된 sd_learn 초기화). vocab 한국어 뜻 등 학습 콘텐츠 자체는 의도적 유지.
- **발견성·언어 고정 전수 수정(외부 피드백 후속)**: ①마이크 권한 거부·음성인식 오류에 복구 방법(주소창 자물쇠) 포함 + 마이크/녹음/Whisper/NVIDIA 관련 사용자 대면 문자열 23곳 tt() 이중언어화 ②SYNC TEST 인트로 {ko,en} ③"명령어/commands" 명령 신설(숨은 명령·파일 형식 안내) + catalog 인트로에서 언급 ④textarea(제출 방법)·MIC 버튼·언어 버튼·파일 열기 버튼 aria를 data-i18n-aria로 구체화.
- **외부 테스터 피드백 대응(연결 발견성)**: "Unclear how to connect Dot Pad" — ①첫 방문 시 navigator.language로 ko/en 자동 선택(sd_lang 없을 때만) ②부팅 채팅에 연결 4단계 안내 1줄 ③"연결 방법"/"how to connect" 음성 명령(단계 안내 음성+텍스트).
- **BLE 버튼 통합**: "기기 여러 대 추가" 버튼 제거 — "기기 추가" 하나가 항상 추가 동작(최대 5대, 연결 중 라벨 "BLE n대 · 추가"), **해제는 기기 목록의 끊기/모두 끊기로만**(navbtn 전체 해제 동작 제거 — 실수 방지).
- **TTS 음량 계측**: 마이크 기능(자막/회의록/메모)의 utterance.volume은 설계대로 0.5(볼륨 지시), 일반 기능 1.0, 종료 후 복귀 정상 — "마이크 기능에서 더 크게 들림"은 기기 오디오 경로(블루투스 HFP 전환·Windows 통신 덕킹·volume 지시 무시 보이스)가 원인. SETUP에 "마이크 중" 미리듣기 버튼(진단용)과 블루투스 안내문 추가.
- **⚠️ 실기기 버그 수정 — BLE 빈 프레임**: requestPaint가 `clear()` 직후에도 즉시 push해 "빈 프레임"이 실기기로 전송 → 자막/회의록/메모에서 내용 추가 때마다 **전 핀이 내려갔다 올라오던** 현상. push를 `setTimeout(0)` 마이크로배치로 바꿔 같은 턴의 clear→draw를 완성 프레임 하나로만 전송. mock BLE 검증: 수정 전 빈 행 강하 6회·기존 행 재전송 → 수정 후 0회·변경 행만 전송. **이 배치 로직을 되돌리지 말 것(§4-3 보강).**
- **기능 업그레이드 6종**: ①maze 랜덤 생성(7×4 셀 재귀 백트래커 → 벽 rect 변환, F2 새 미로 — 15회 생성 전수 BFS 도달성 검증) ②calc 연속 계산("곱하기 2"처럼 연산자로 시작하면 직전 결과에 이어감) ③quiz 오답 노트(`sd_wrong` 적립, "오답 복습" 발화→review 모드, 맞히면 삭제) ④timetable F4 "지금 몇 교시"(기본 시정 09:00 시작·50분 수업) ⑤timer 종료 시 촉각 알람(전체 핀 400ms 펄스 5회) ⑥xlate 대상 미지정 시 한↔영 양방향 자동(detectTextLang 기반)+F3 인식 언어 전환. localMatch xlate는 언어 명시일 때만 `to` 설정.
- **품질 마감 5종+1**: ①TTS 에코 가드 — `TTS_RECENT`(10초 창)+`isTtsEcho`(포함/2-gram 0.7)로 자체 음성이 자막·회의록·받아쓰기에 재입력되는 것 차단(dp.listen 콜백 래핑) ②minutes 렌더 성능 — 라인별 셀 수 캐시(`_lc`)+`drawBrailleBlock` `opts.cellsPre`(전역 페이지 경계 유지)로 꼬리만 점역, **전체 점역과 프레임버퍼 동등성 테스트(3/12/60/150줄) 통과**. caption은 6000자 절사 ③부팅 시 내장 데모 이름 기준 최신 교체+누적 중복 제거 ④"버전" 발화 → document.lastModified 낭독, footer BUILD 표시 ⑤"미매칭 목록" 시 클립보드 자동 복사 ⑥**기저 버그 수정: specFeature `meta.id||Date.now()`가 id 0(DEMO)을 falsy 처리 → 부팅마다 DEMO가 새 id로 누적되던 문제** → `meta.id!=null` 판정으로 수정.
- **매처 확장 3종**: ①MATCH_RULES 한/영 동의어 대폭 보강(알람/지금 시간/어휘/메모해/환산/제비뽑기/what time is it/how many inches 등 — 기존 40발화 스냅샷 점수까지 완전 동일 유지, 'quiz me'처럼 기존 발화 점수를 바꾸는 키워드는 제외 원칙) ②미매칭 로그 `sd_miss`(localMatch null 시 기록, 발화 "미매칭 목록"/"미매칭 삭제"로 열람·정리 — 사전 보강용 현장 데이터) ③T3 슬롯필 성공 시 `sd_learn`에 `learnKey(정규화 문장)→spec` 저장, T2 실패 시 **T2.5 학습 재사용**으로 오프라인 처리(문장부호·공백 변형도 정규화로 흡수. 동일 원문은 T1 라이브러리가 먼저 잡음).
- **2차 워크스루 수정**: T2 채팅 표시명을 `tplDisplayName`(LOCAL: 접두 제거), 되묻기(clarify)와 생성 실패를 음성으로도 안내, convert `findUnits` 채움문자 NUL→공백(파일이 바이너리 판정되던 문제 — **소스에 제어문자 금지**).
- **오프라인 보강 4종**: ①OPEN이 `.csv` 지원 — 2열=vocab, 3열+=quiz(quizFromRows), 요일 헤더=timetable, 1열=list_nav. 헤더 자동 감지(2행 이상일 때만). CSV 기능은 스펙 기반이라 라이브러리에 저장(동명 파일 재열기 시 교체). ②`catalog` 템플릿+칩("기능 목록") — 팬 탐색, F1 즉시 실행. 숨김 6종·braille_doc 미노출 유지. ③minutes 자동 보존(`sd_minutes`, 문장마다 저장·F4 삭제·재로드 시 복구+announce). ④생활 템플릿 timetable/checklist/convert(길이·무게·온도, 단위사전 UD·영문 단어경계 처리).

---
**요약**: 동작 보존이 전부. 불변 항목(§4, 특히 신규 8~13)은 의미 고정, 변경은 작게+검증(§6), 배포는 단일 index.html(§4-6). 이어서 작업하려면 이 zip을 풀고 `index.html`부터 보면 됩니다.
