/* v3.test.mjs — 페르소나 피드백 반영 기능 테스트
   스플릿 / 턴 타이머 / 관전+승격 / 점수 모드 / 이모트 / 재접속 유예 / 호스트 승계 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');

import { createTable, EMOTES } from '../src/game/table.js';
import { memHub } from '../src/net/transport.js';
import { createRoomClient } from '../src/net/client.js';
import { MAX_SEATS } from '../src/config.js';

const t = makeChecker();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('── v3 기능 테스트 ──');

/* 1) 스플릿 */
{
  const speeches = [];
  const eng = createTable({
    announce: (text, to) => speeches.push({ text, to }),
    deckFactory: () => [{ r: '6', s: 'H' }, { r: '5', s: 'S' }, { r: '7', s: 'C' }, { r: '8', s: 'D' }, { r: '10', s: 'H' }, { r: '8', s: 'S' }],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '솔로');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  const p = eng.state.players[0];
  t.ok('스플릿 가능 안내 (팬 오른쪽)', speeches.some((s) => /스플릿/.test(s.text)));
  eng.action('p1', 'split');
  t.ok('스플릿: 핸드 2개', p.hands.length === 2 && p.hands[0].length === 2 && p.hands[1].length === 2);
  t.ok('스플릿: 추가 베팅 차감 (100-50)', p.chips === 50);
  eng.action('p1', 'stand');
  t.ok('첫 핸드 스탠드 → 두 번째 핸드', p.activeHand === 1 && speeches.some((s) => /다음 핸드/.test(s.text)));
  eng.action('p1', 'stand');
  await wait(80);
  t.ok('두 핸드 정산 (13/14 vs 17 = 2패)', eng.state.phase === 'result' && p.results.length === 2 && p.results.every((r) => r.outcome === 'lose'));
  t.ok('라운드 요약 발화', speeches.some((s) => /라운드 결과 요약/.test(s.text)));
}

/* 2) 턴 타이머 */
{
  const speeches = [];
  const eng = createTable({
    announce: (text) => speeches.push(text),
    deckFactory: () => [{ r: '8', s: 'D' }, { r: '7', s: 'H' }, { r: '9', s: 'C' }, { r: '10', s: 'S' }],
    dealerDelay: 10, turnTimeout: 120
  });
  eng.addPlayer('p1', '잠수');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  const phaseAtDeal = eng.state.phase;
  await wait(300);
  t.ok('턴 타이머: 자동 스탠드 발동', phaseAtDeal === 'acting' && speeches.some((s) => /시간 초과/.test(s)));
  await wait(100);
  t.ok('턴 타이머: 결과 도달', eng.state.phase === 'result');
}

/* 3) 관전 + 자동 승격 */
{
  const speeches = [];
  const eng = createTable({ announce: (text, to) => speeches.push({ text, to }), dealerDelay: 10 });
  for (let i = 0; i < MAX_SEATS; i++) eng.addPlayer('s' + i, '좌석' + i);
  eng.addPlayer('spec1', '관전이');
  t.ok('좌석 초과 → 관전 입장', eng.state.players.length === MAX_SEATS && eng.state.spectators.length === 1);
  eng.action('spec1', 'hit');
  t.ok('관전자 게임 액션 차단', speeches.some((s) => s.to === 'spec1' && /참여할 수 없습니다/.test(s.text)));
  eng.action('spec1', 'status');
  t.ok('관전자 상태 읽기 동작', speeches.some((s) => s.to === 'spec1' && /관전 중입니다/.test(s.text)));
  eng.removePlayer('s3');
  t.ok('자리 나면 자동 승격', eng.state.players.some((p) => p.id === 'spec1') && eng.state.spectators.length === 0);
}

/* 4) 점수 모드 */
{
  const speeches = [];
  const eng = createTable({ announce: (text) => speeches.push(text), dealerDelay: 10 });
  eng.addPlayer('h', '선생님');
  eng.action('h', 'set', { key: 'scoreMode', value: true });
  t.ok('점수 모드 설정 발화', speeches.some((s) => /점수 모드로 전환/.test(s)));
  eng.action('h', 'start');
  const betting = speeches[speeches.length - 1];
  t.ok('베팅→점수 치환', /점수/.test(betting) && !/베팅/.test(betting));
  eng.action('h', 'status');
  t.ok('칩→점수 치환 (상태 읽기)', /점수 \d+/.test(speeches[speeches.length - 1]) && !/칩/.test(speeches[speeches.length - 1]));
  t.ok('publicState에 scoreMode 노출', eng.publicState().opts.scoreMode === true);
}

/* 5) 이모트 + 쿨다운 */
{
  const speeches = [];
  const eng = createTable({ announce: (text, to, kind) => speeches.push({ text, kind }) });
  eng.addPlayer('p1', '민수');
  eng.action('p1', 'emote', 0);
  t.ok('이모트 전송', speeches.some((s) => s.text === '민수: ' + EMOTES[0] && s.kind === 'emote'));
  eng.action('p1', 'emote', 1);
  t.ok('이모트 쿨다운(4초)', speeches.some((s) => /잠시 후/.test(s.text)));
}

/* 6) 재접속 유예 */
{
  const hub = memHub();
  const mk = (id, nick, isHost) => {
    const speeches = [];
    const transport = hub.channel('R1');
    const client = createRoomClient({
      transport, me: { id, nick }, isHost,
      say: (txt) => speeches.push(txt),
      engineOpts: { dealerDelay: 10, turnTimeout: 0 },
      graceMs: 150
    });
    return { client, speeches, transport, id, nick };
  };
  const H = mk('h1', '호스트', true);
  const A = mk('a1', '아름', false);
  await H.client.join(); await A.client.join(); await wait(30);

  A.transport.leave();
  await wait(40);
  t.ok('끊김 감지 → 유예 안내', H.speeches.some((s) => /연결이 끊겼습니다/.test(s)));
  t.ok('유예 중 자리 유지', H.client.state.players.length === 2);

  const A2 = mk('a1', '아름', false);
  await A2.client.join(); await wait(50);
  t.ok('유예 내 복귀 → 자리·칩 유지', H.client.state.players.length === 2 && H.speeches.some((s) => /다시 연결|재접속/.test(s)));

  A2.transport.leave();
  await wait(250);
  t.ok('유예 만료 → 제거', H.client.state.players.length === 1);
  H.client.leave();
}

/* 7) 호스트 승계 */
{
  const hub = memHub();
  const mk = (id, nick, isHost) => {
    const speeches = [];
    const transport = hub.channel('R2');
    const client = createRoomClient({
      transport, me: { id, nick }, isHost,
      say: (txt) => speeches.push(txt),
      engineOpts: { dealerDelay: 10, turnTimeout: 0 },
      graceMs: 150
    });
    return { client, speeches, id, nick };
  };
  const H = mk('h1', '호스트', true);
  const A = mk('a1', '아름', false);
  const B = mk('b1', '보람', false);
  await H.client.join(); await A.client.join(); await B.client.join(); await wait(30);

  H.client.sendAction('start'); await wait(20);
  H.client.sendAction('confirm'); A.client.sendAction('confirm'); B.client.sendAction('confirm');
  await wait(600);
  for (let i = 0; i < 6; i++) { H.client.sendAction('stand'); A.client.sendAction('stand'); B.client.sendAction('stand'); await wait(60); }
  await wait(300);

  const chipsBefore = {};
  H.client.state.players.forEach((p) => { chipsBefore[p.id] = p.chips; });

  H.client.leave();
  await wait(100);
  t.ok('승계: 새 호스트 지정', A.client.isHostNow === true);
  t.ok('승계: 새 라운드 시작', A.client.state && A.client.state.phase === 'betting');
  t.ok('승계: 칩 보존', A.client.state.players.every((p) => p.chips === chipsBefore[p.id]));
  t.ok('승계: 게스트도 새 상태 수신', B.client.state && B.client.state.phase === 'betting');
  t.ok('승계 안내 발화', B.speeches.some((s) => /호스트가.*변경/.test(s)));
  B.client.sendAction('bet+'); await wait(30);
  t.ok('승계 후 액션 라우팅', A.client.state.players.find((p) => p.id === 'b1').bet !== 25 || B.speeches.some((s) => /베팅 50/.test(s)));
  A.client.leave(); B.client.leave();
}

process.exit(t.summary());
