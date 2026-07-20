/* ble.js — DotPad BLE 드라이버 (dotpad-dev 검증 패턴)
   계약(실기기 검증 — 의미 변경 금지):
   1. setCallBack은 connectBleDevice 이전에 등록 (늦으면 Connected 유실)
   2. onMessage 'Connected' 수신 후에만 전송 시작
   3. 행단위 displayLineData(row+1, 0, hex60, GraphicMode)만 사용 — 전체 전송 금지
   4. keep-alive: 1초마다 1행 재전송
   5. 기기별 lastSent 행 차분 fan-out, 전송 간격 = 200ms × 기기수
   6. 빈 프레임 마이크로배치: setTimeout(0)으로 같은 턴 종료 후 완성 프레임만 push */

const BLE = {
  connected: false,
  devs: [],                    // [{dev,raw,name,ready,lastSent[10],lastTextHex,kaRow}]
  MAX: 5,
  MIN_INTERVAL: 200,
  sdkMod: null, sdk: null, DM: null,
  frameProvider: null,         // () => {rows:[10 hex], textHex}
  onKeyHandler: null,          // (k: 'F1'..'F4'|'PAN_LEFT'|'PAN_RIGHT') => void
  onStatus: null,              // (code, detail) => void  (UI 알림용)
  classroom: false,            // 교실 모드: 1번 기기(교사)의 키만 허용
  _ka: null, _flushT: null, _pendT: null, _last: 0,

  _status(code, detail) { if (this.onStatus) this.onStatus(code, detail); },

  /* SDK 동적 로드 — 테스트에서 이 함수를 오버라이드해 모의 SDK 주입
     경로는 페이지 baseURI 기준(서브패스 배포 대응: 빌드 후 assets/ 안에서 import되므로) */
  loadSDK() {
    if (this.sdkMod) return Promise.resolve(this.sdkMod);
    const base = (typeof document !== 'undefined' && document.baseURI) || '';
    const paths = [];
    if (base) paths.push(new URL('./DotPadSDK-3.0.0.js', base).href);
    paths.push('./DotPadSDK-3.0.0.js', '/DotPadSDK-3.0.0.js');
    let p = Promise.reject(new Error('no sdk'));
    paths.forEach((path) => { p = p.catch(() => import(/* @vite-ignore */ path)); });
    return p.then((m) => { this.sdkMod = m; return m; });
  },

  connect() { return this.addDevice(); },

  addDevice() {
    const nav = typeof navigator !== 'undefined' ? navigator : globalThis.navigator;
    if (!nav || !nav.bluetooth) { this._status('no-bluetooth'); return Promise.resolve(false); }
    if (this.devs.length >= this.MAX) { this._status('max-devices', this.MAX); return Promise.resolve(false); }
    return this.loadSDK().then((m) => {
      this.DM = m.DisplayMode;
      if (!this.sdk) {
        this.sdk = new m.DotPadSDK();
        // 계약 1: 콜백 선등록 (connectBleDevice보다 먼저)
        this.sdk.setCallBack(this._onMessage.bind(this), this._onKey.bind(this));
      }
      const scanner = new m.DotPadScanner();
      return scanner.startBleScan().then((d) => {
        if (!d) { this._status('scan-cancel'); return false; }
        return this.sdk.connectBleDevice(d).then((res) => {
          // 공식 SDK는 DotDevice 객체를 반환(null=실패), 모의 SDK는 입력 기기 그대로 반환
          if (res === null) { this._status('connect-fail', 'SDK connect failed'); return false; }
          const dot = res || d;
          this.devs.push({
            dev: dot, raw: d, name: d.name || 'DotPad',
            ready: false,                       // 계약 2: Connected 게이트
            lastSent: new Array(10).fill(null),
            lastTextHex: null, kaRow: 0
          });
          return true;
        });
      });
    }).catch((e) => { this._status('connect-fail', e && e.message); return false; });
  },

  disconnectAll() {
    this.devs.forEach((e) => { try { this.sdk.disconnect(e.dev); } catch (_) {} });
  },

  _onMessage(dev, code) {
    // 공식 SDK는 DotDevice, 모의 SDK는 원시 기기 객체를 전달 → 둘 다 매칭
    const match = (x) => x.dev === dev || x.raw === dev;
    if (code === 'Connected') {
      const e = this.devs.find(match);
      if (e) e.ready = true;
      this.connected = this.devs.some((x) => x.ready);
      this._status('connected', e && e.name);
      this._startKeepAlive();
      this.requestFlush();                      // 연결 직후 전체 프레임 전송
    } else if (code === 'Disconnected') {
      this.devs = this.devs.filter((x) => !match(x));
      this.connected = this.devs.some((x) => x.ready);
      if (!this.connected) this._stopKeepAlive();
      this._status('disconnected');
    } else if (code === 'ConnectedFail' || code === 'CommandError') {
      this._status('error', code);
    }
  },

  _onKey(dev, keyCode) {
    if (this.classroom && this.devs.length && dev !== this.devs[0].dev && dev !== this.devs[0].raw) return; // 학생 기기 키 무시
    const map = {
      KeyFunction1: 'F1', KeyFunction2: 'F2', KeyFunction3: 'F3', KeyFunction4: 'F4',
      PanningLeft: 'PAN_LEFT', PanningRight: 'PAN_RIGHT'
    };
    const k = map[keyCode];
    if (k && this.onKeyHandler) this.onKeyHandler(k);
  },

  /* 계약 6: 마이크로배치 — clear→draw가 같은 턴에서 끝난 뒤 완성 프레임만 push */
  requestFlush() {
    if (this._flushT != null) return;
    this._flushT = setTimeout(() => { this._flushT = null; this._push(); }, 0);
  },

  _push() {
    if (!this.connected || !this.frameProvider || !this.sdk) return;
    const gap = this.MIN_INTERVAL * Math.max(1, this.devs.length);
    const now = Date.now();
    if (now - this._last < gap) {
      if (!this._pendT) {
        this._pendT = setTimeout(() => { this._pendT = null; this._push(); }, gap - (now - this._last));
      }
      return;
    }
    this._last = now;
    const { rows, textHex } = this.frameProvider();
    // 계약 3+5: 행단위 전송, 기기별 행 차분 fan-out
    this.devs.forEach((e) => {
      if (!e.ready) return;
      rows.forEach((hex, i) => {
        if (e.lastSent[i] !== hex) {
          this.sdk.displayLineData(i + 1, 0, hex, this.DM.GraphicMode, e.dev);
          e.lastSent[i] = hex;
        }
      });
      if (textHex != null && e.lastTextHex !== textHex) {
        this.sdk.displayLineData(0, 0, textHex, this.DM.TextMode, e.dev);
        e.lastTextHex = textHex;
      }
    });
  },

  /* 계약 4: keep-alive — 1초마다 1행 재전송(순환) */
  _startKeepAlive() {
    if (this._ka) return;
    this._ka = setInterval(() => {
      this.devs.forEach((e) => {
        if (!e.ready || !this.sdk) return;
        const hex = e.lastSent[e.kaRow] || '0'.repeat(60);
        this.sdk.displayLineData(e.kaRow + 1, 0, hex, this.DM.GraphicMode, e.dev);
        e.kaRow = (e.kaRow + 1) % 10;
      });
    }, 1000);
  },
  _stopKeepAlive() { if (this._ka) { clearInterval(this._ka); this._ka = null; } }
};

if (typeof globalThis !== 'undefined') globalThis.BLE = BLE;  // 시뮬레이터 주입 지점
export default BLE;
