/* insurance.test.mjs — 인슈어런스(딜러 오픈 A) 검증 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');
import { createTable } from '../src/game/table.js';

const t = makeChecker();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
console.log('── 인슈어런스 테스트 ──');

/* 케이스 1: 딜러 블랙잭 → 보험 건 사람 이득
   pop 순서: p1=9C, d1=AS(오픈), p2=8H, d2=KH(홀=블랙잭) */
{
  const speeches = [];
  const eng = createTable({
    announce: (text, to) => speeches.push({ text, to }),
    deckFactory: () => [{ r: 'K', s: 'H' }, { r: '8', s: 'H' }, { r: 'A', s: 'S' }, { r: '9', s: 'C' }],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '보험러');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  const p = eng.state.players[0];
  t.ok('딜러 A 오픈 → 보험 국면', eng.state.phase === 'insurance');
  t.ok('보험 국면 안내 발화(설명 포함)', speeches.some((s) => /보험은 딜러가 블랙잭일 때만/.test(s.text) && /패스/.test(s.text)));
  t.ok('베팅 25 차감 후 칩 75', p.chips === 75);
  eng.action('p1', 'insure');   // 보험 13(25의 절반 올림) 차감 후 즉시 정산(전원 결정)
  // 전원 결정 → 딜러 블랙잭 정산: 75 - 13(보험) + 39(보험 2:1) + 0(원 핸드 패) = 101
  t.ok('딜러 블랙잭 정산 → 결과', eng.state.phase === 'result');
  t.ok('보험 지급 (75-13+39=101)', p.chips === 101, p.chips);
  t.ok('원 핸드 패배', p.results[0].outcome === 'lose');
  t.ok('딜러 홀 공개', !eng.state.hideHole);
}

/* 케이스 2: 딜러 블랙잭 아님 → 보험 몰수, 게임 계속
   pop 순서 p1=9C, d1=AS, p2=8H, d2=6D → 딜러 A+6 소프트17 스탠드, 플레이어 17 → 푸시 */
{
  const speeches = [];
  const eng = createTable({
    announce: (text, to) => speeches.push({ text, to }),
    deckFactory: () => [{ r: '6', s: 'D' }, { r: '8', s: 'H' }, { r: 'A', s: 'S' }, { r: '9', s: 'C' }],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '패스러');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  t.ok('보험 국면 진입', eng.state.phase === 'insurance');
  eng.action('p1', 'insure');   // 보험 13, 딜러 블랙잭 아님 → acting
  const p = eng.state.players[0];
  t.ok('보험 차감 (75-13=62)', p.chips === 62, p.chips);
  t.ok('블랙잭 아님 → 플레이 국면', eng.state.phase === 'acting');
  t.ok('보험 몰수 안내', speeches.some((s) => /블랙잭이 아닙니다/.test(s.text)));
  eng.action('p1', 'stand');
  await wait(80);
  // 딜러 A+6=소프트17 스탠드, 플레이어 17 → 푸시(베팅 25 반환), 보험 13 몰수
  t.ok('푸시', p.results[0].outcome === 'push');
  t.ok('정산 (62+25=87, 보험 13 몰수)', p.chips === 87, p.chips);
}

/* 케이스 3: 패스 → 딜러 블랙잭이면 원 핸드만 패, 보험 무관 */
{
  const speeches = [];
  const eng = createTable({
    announce: (text, to) => speeches.push({ text, to }),
    deckFactory: () => [{ r: 'K', s: 'H' }, { r: '8', s: 'H' }, { r: 'A', s: 'S' }, { r: '9', s: 'C' }],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '노보험');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  eng.action('p1', 'pass');
  const p = eng.state.players[0];
  t.ok('패스 → 딜러 블랙잭 → 결과', eng.state.phase === 'result');
  t.ok('보험 없이 원 핸드 패 (칩 75 유지)', p.chips === 75 && p.results[0].outcome === 'lose');
}

process.exit(t.summary());
