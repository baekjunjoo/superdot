/* dotpad-sim.mjs — DotPad BLE 계약 검증 (dotpad-simulator 하네스)
   실기기 없이 모의 SDK를 주입해 "기기에 실제로 어떤 바이트가 갔는가"까지 검증. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createMockSdk, makeChecker } = require('./lib/dotpad-mock.cjs');

try {
  Object.defineProperty(globalThis, 'navigator', { value: { bluetooth: {} }, configurable: true });
} catch (_) { globalThis.navigator.bluetooth = globalThis.navigator.bluetooth || {}; }

const { default: BLE } = await import('../src/dotpad/ble.js');
const { createGame } = await import('../src/game/controller.js');
const { textLineHex, statusText } = await import('../src/dotpad/render.js');

const t = makeChecker();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pixel(rows, x, y) {
  const gy = y >> 2, gx = x >> 1;
  const b = parseInt(rows[gy].substr(gx * 2, 2), 16);
  return !!(b & (1 << ((y % 4) + (x % 2) * 4)));
}

/* 결정적 덱: pop 순서 = 플레이어 9S, 딜러 7H, 플레이어 7D, 딜러 9C(홀), 히트 2S, 딜러히트 KH(버스트) */
const testDeck = () => ([
  { r: 'K', s: 'H' }, { r: '2', s: 'S' }, { r: '9', s: 'C' },
  { r: '7', s: 'D' }, { r: '7', s: 'H' }, { r: '9', s: 'S' }
]);

const speeches = [];
const game = createGame({
  say: (txt) => speeches.push(txt),
  deckFactory: testDeck,
  dealerDelay: 50
});

console.log('── DotPad BLE 계약 검증 ──');

BLE.frameProvider = () => { const f = game.frame(); return { rows: f.rows, textHex: f.textHex }; };
BLE.onKeyHandler = (k) => game.onKey(k);
game.subscribe(() => BLE.requestFlush());
game.intro();

t.ok('무음 금지: 로드 즉시 키 안내 발화', speeches.length > 0 && /에프1/.test(speeches[0]));

const sim = createMockSdk();
BLE.loadSDK = () => Promise.resolve(sim.module);

await BLE.connect();
t.ok('Connected 게이트: 연결 resolve 직후엔 무전송', sim.log.length === 0);
await wait(200);
t.ok('콜백 선등록 (setCallBack < connectBleDevice)', sim.order.callbackSetAt < sim.order.connectCalledAt);
t.ok('Connected 후 전송 시작', sim.log.length > 0);

const g = () => sim.log.filter((x) => x.mode === 'GraphicMode');
const txt = () => sim.log.filter((x) => x.mode === 'TextMode');
t.ok('그래픽 행 규격 (lineId 1~10, hex 60자)', g().every((x) => x.lineId >= 1 && x.lineId <= 10 && x.hex.length === 60));
t.ok('텍스트라인 규격 (lineId 0, hex 40자)', txt().length > 0 && txt().every((x) => x.lineId === 0 && x.hex.length === 40));

const expectBet = textLineHex('bet 25 chips 100');
t.ok('텍스트라인 점형 일치 (bet 25 chips 100)', txt()[txt().length - 1].hex === expectBet, txt()[txt().length - 1].hex);
let rows = sim.deviceState();
t.ok('베팅 화면: 칩 게이지 제일 하단 (기준선 y34 + 막대 y36~39)', pixel(rows, 5, 34) && pixel(rows, 5, 37) && pixel(rows, 5, 39));

clearInterval(BLE._ka); BLE._ka = null;

await wait(500);
const len0 = sim.log.length;
BLE.requestFlush();
await wait(600);
t.ok('행 차분: 무변경 시 재전송 없음', sim.log.length === len0, `+${sim.log.length - len0}`);

sim.fireKey('PanningRight'); await wait(600);
t.ok('팬 오른쪽: 베팅 25→50', game.state.bet === 50);
t.ok('베팅 변경 즉시 발화', /베팅 50/.test(speeches[speeches.length - 1]));
t.ok('텍스트라인 갱신 (bet 50)', txt()[txt().length - 1].hex === textLineHex('bet 50 chips 100'));
sim.fireKey('PanningLeft'); await wait(600);
t.ok('팬 왼쪽: 베팅 50→25', game.state.bet === 25);

sim.fireKey('KeyFunction1'); await wait(600);
t.ok('F1 배분: 플레이어 차례', game.state.phase === 'player');
t.ok('칩 차감 (100→75)', game.state.chips === 75);
rows = sim.deviceState();
t.ok('딜러 카드 상단 렌더 (11×16)', pixel(rows, 0, 1) && pixel(rows, 10, 1));
t.ok('플레이어 카드 하단 렌더 (y=22)', pixel(rows, 0, 22) && pixel(rows, 10, 22));
t.ok('구분선(점선) 렌더', pixel(rows, 0, 19) && !pixel(rows, 4, 19));
t.ok('딜러 홀카드 X 패턴', pixel(rows, 14, 3));
t.ok('배분 발화에 카드 이름', /스페이드 9/.test(speeches[speeches.length - 1]));

sim.fireKey('KeyFunction1'); await wait(600);
t.ok('F1 히트: 3장 (합계 18)', game.state.player.length === 3);
sim.fireKey('KeyFunction3');
t.ok('불가 동작도 음성 안내', /더블다운/.test(speeches[speeches.length - 1]));
sim.fireKey('KeyFunction2'); await wait(800);
t.ok('F2 스탠드 → 딜러 버스트 → 승리', game.state.phase === 'result' && game.state.result.outcome === 'win');
t.ok('정산 (75+50=125)', game.state.chips === 125);
await wait(600);
t.ok('결과 텍스트라인 (win chips 125)', txt()[txt().length - 1].hex === textLineHex(statusText(game.state)));
sim.fireKey('KeyFunction4');
t.ok('F4 상태 읽기 항상 동작', /다음 판/.test(speeches[speeches.length - 1]));

await BLE.addDevice(); await wait(200);
t.ok('기기 2대 연결', BLE.devs.length === 2);
const dev2 = BLE.devs[1].dev;
sim.fireKey('KeyFunction1'); await wait(900);
t.ok('신규 기기에도 미러링', sim.log.some((x) => x.dev === dev2 && x.mode === 'GraphicMode'));
sim.fireMessage('Disconnected', dev2); await wait(50);
t.ok('부분 해제 시 나머지 유지', BLE.devs.length === 1 && BLE.connected);

await BLE.addDevice(); await wait(200);
const student = BLE.devs[1].dev;
BLE.classroom = true;
const betBefore = game.state.bet;
sim.fireKey('PanningRight', student); await wait(100);
t.ok('교실 모드: 학생 기기 키 무시', game.state.bet === betBefore);
sim.fireKey('PanningRight', BLE.devs[0].dev); await wait(100);
t.ok('교실 모드: 교사 기기 키 반영', game.state.bet !== betBefore);
BLE.classroom = false;
sim.fireMessage('Disconnected', student); await wait(50);

BLE._startKeepAlive();
const lenKa = sim.log.length;
await wait(1200);
t.ok('keep-alive 재전송', sim.log.length > lenKa);

process.exit(t.summary());
