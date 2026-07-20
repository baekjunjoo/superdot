/* table.test.mjs — 멀티플레이 통합 테스트 (인메모리 transport, 호스트 1 + 게스트 2) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');

import { memHub } from '../src/net/transport.js';
import { createRoomClient } from '../src/net/client.js';
import { renderRoom, roomStatusText, textLineHex } from '../src/dotpad/render.js';

const t = makeChecker();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('── 멀티플레이 통합 테스트 ──');

/* 결정적 덱 (pop 순서): H1=10S A1=9C B1=AS D1=6C / H2=8H A2=7D B2=KH D2=10D / A히트=5S / 딜러히트=9H(버스트) */
const deck = () => ([
  { r: '9', s: 'H' }, { r: '5', s: 'S' },
  { r: '10', s: 'D' }, { r: 'K', s: 'H' }, { r: '7', s: 'D' }, { r: '8', s: 'H' },
  { r: '6', s: 'C' }, { r: 'A', s: 'S' }, { r: '9', s: 'C' }, { r: '10', s: 'S' }
]);

const hub = memHub();
const CODE = 'TEST01';

function mkClient(id, nick, isHost) {
  const speeches = [];
  const client = createRoomClient({
    transport: hub.channel(CODE),
    me: { id, nick }, isHost,
    say: (txt) => speeches.push(txt),
    engineOpts: isHost ? { deckFactory: deck, dealerDelay: 30, turnTimeout: 0 } : {}
  });
  const states = [];
  client.onStateChange = (s) => states.push(s);
  return { client, speeches, states, id, nick };
}

const H = mkClient('h1', '호스트', true);
const A = mkClient('a1', '아름', false);
const B = mkClient('b1', '보람', false);

await H.client.join();
await A.client.join();
await B.client.join();
await wait(50);

let st = H.client.state;
t.ok('3명 입장', st.players.length === 3);
t.ok('게스트도 상태 수신', A.client.state && A.client.state.players.length === 3);
t.ok('입장 안내 발화', A.speeches.some((s) => /입장/.test(s)));

A.client.sendAction('start');
await wait(20);
t.ok('게스트 시작 거부', H.client.state.phase === 'lobby' && A.speeches.some((s) => /호스트만/.test(s)));

H.client.sendAction('start');
await wait(20);
t.ok('베팅 국면 진입', H.client.state.phase === 'betting');

A.client.sendAction('bet+');
await wait(20);
t.ok('게스트 베팅 조절 반영', H.client.state.players.find((p) => p.id === 'a1').bet === 50);
A.client.sendAction('bet-');
await wait(20);

H.client.sendAction('confirm');
A.client.sendAction('confirm');
await wait(20);
t.ok('일부 확정 시 아직 배분 안 됨', H.client.state.phase === 'betting');
B.client.sendAction('confirm');
await wait(30);

st = H.client.state;
t.ok('전원 확정 → 배분', st.phase === 'acting');
t.ok('홀카드 브로드캐스트 은닉', A.client.state.dealer[1].hidden === true && !A.client.state.dealer[1].r);
t.ok('블랙잭 자동 완료 (보람)', st.players.find((p) => p.id === 'b1').done === true);
t.ok('첫 차례 = 호스트', st.turnId === 'h1');
t.ok('차례 개인 안내', H.speeches.some((s) => /당신 차례/.test(s)) && A.speeches.some((s) => /호스트 님 차례/.test(s)));

A.client.sendAction('hit');
await wait(20);
t.ok('차례 아닌 행동 거부', A.speeches.some((s) => /아직 당신 차례가 아닙니다/.test(s)));

H.client.sendAction('stand');
await wait(20);
t.ok('턴 넘김 (아름)', H.client.state.turnId === 'a1');
A.client.sendAction('hit');
await wait(150);

st = H.client.state;
t.ok('딜러 종료 → 결과', st.phase === 'result');
t.ok('딜러 버스트 (25)', st.dealer.length === 3 && !st.hideHole);
t.ok('게스트에도 홀카드 공개', A.client.state.dealer[1].r === '10');

const hp = st.players.find((p) => p.id === 'h1');
const ap = st.players.find((p) => p.id === 'a1');
const bp = st.players.find((p) => p.id === 'b1');
t.ok('호스트 승리 정산 125', hp.result === 'win' && hp.chips === 125);
t.ok('아름 승리 정산 125', ap.result === 'win' && ap.chips === 125);
t.ok('보람 블랙잭 정산 137', bp.result === 'blackjack' && bp.chips === 137);
t.ok('결과 개인 발화', B.speeches.some((s) => /블랙잭/.test(s)));

const f = renderRoom(A.client.state, 'a1');
t.ok('닷패드 행 인코딩 10행', f.rows.length === 10 && f.rows.every((r) => r.length === 60));
t.ok('닷패드 텍스트라인 = 점역 일치', f.textHex === textLineHex(roomStatusText(A.client.state, 'a1')));
t.ok('상태 문구 (win chips 125)', roomStatusText(A.client.state, 'a1') === 'win chips 125');

H.client.sendAction('ready');
A.client.sendAction('ready');
B.client.sendAction('ready');
await wait(30);
t.ok('전원 준비 → 2라운드', H.client.state.phase === 'betting' && H.client.state.round === 2);

B.client.leave();
await wait(30);
t.ok('퇴장 반영', H.client.state.players.length === 2);

A.client.sendAction('status');
await wait(20);
t.ok('상태 읽기 응답', A.speeches.some((s) => /보유 칩 125/.test(s)));

process.exit(t.summary());
