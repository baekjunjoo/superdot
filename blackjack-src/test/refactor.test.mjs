/* refactor.test.mjs — 리팩토링/버그픽스 회귀 테스트
   1) 스플릿 21은 내추럴 블랙잭(1.5배)이 아니라 일반 승리로 정산
   2) 인슈어런스 국면에서 미결정자가 나가도 라운드가 멈추지 않음
   3) 스플릿한 에이스는 각 핸드에 한 장씩만 받고 종료 (표준 규칙)
   4) 덱 소진 시 리셔플로 크래시 없이 라운드 완료 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');

import { createTable } from '../src/game/table.js';
import { settle } from '../src/game/blackjack.js';

const t = makeChecker();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const C = (r, s = 'S') => ({ r, s });
console.log('── 리팩토링 회귀 테스트 ──');

/* 1) settle playerNatural */
{
  const natural = settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('10'), C('9')], playerNatural: true });
  t.ok('원 핸드 A+K = 블랙잭 1.5배 (payout 50)', natural.outcome === 'blackjack' && natural.payout === 50);
  const split = settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('10'), C('9')], playerNatural: false });
  t.ok('스플릿 후 21 = 일반 승리 (payout 40)', split.outcome === 'win' && split.payout === 40);
  const bothNat = settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('A', 'H'), C('Q', 'H')], playerNatural: true });
  t.ok('양쪽 내추럴 = 푸시', bothNat.outcome === 'push' && bothNat.payout === 20);
  const splitVsDealerBJ = settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('A', 'H'), C('Q', 'H')], playerNatural: false });
  t.ok('스플릿 21 vs 딜러 내추럴 = 패배', splitVsDealerBJ.outcome === 'lose' && splitVsDealerBJ.payout === 0);
}

/* 2) 인슈어런스 국면 이탈 → 정지 안 함
   deal pop 순서: p1a,p2a,dUp,p1b,p2b,dHole */
{
  const eng = createTable({
    announce: () => {},
    deckFactory: () => [C('5', 'C'), C('8', 'S'), C('7', 'S'), C('A', 'H'), C('9', 'S'), C('10', 'S')],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '가'); eng.addPlayer('p2', '나');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm'); eng.action('p2', 'confirm');
  t.ok('딜러 오픈 A → 보험 국면', eng.state.phase === 'insurance');
  eng.action('p1', 'pass');
  t.ok('한 명만 결정 → 아직 보험 국면 유지', eng.state.phase === 'insurance');
  eng.removePlayer('p2');   // 미결정자 이탈
  t.ok('미결정자 이탈 → 보험 해소, 게임 진행', eng.state.phase === 'acting');
}

/* 3) 스플릿 에이스 = 각 한 장
   deal pop: p1a,dUp,p1b,dHole → 이후 split1,split2 */
{
  const eng = createTable({
    announce: () => {},
    deckFactory: () => [C('7', 'H'), C('10', 'S'), C('5', 'C'), C('A', 'D'), C('9', 'H'), C('A', 'S')],
    dealerDelay: 10, turnTimeout: 0
  });
  eng.addPlayer('p1', '솔로');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  const p = eng.state.players[0];
  t.ok('초기 핸드 A,A', p.hands[0].length === 2 && p.hands[0].every((c) => c.r === 'A'));
  eng.action('p1', 'split');
  t.ok('스플릿 에이스: 각 핸드 2장', p.hands.length === 2 && p.hands[0].length === 2 && p.hands[1].length === 2);
  t.ok('스플릿 에이스: 즉시 종료(둘 다 완료)', p.handDone[0] === true && p.handDone[1] === true && p.done === true);
  eng.action('p1', 'hit');   // 더 이상 히트 불가 (딜러 차례)
  t.ok('스플릿 에이스 후 히트 불가', p.hands[0].length === 2 && p.hands[1].length === 2);
}

/* 4) 덱 소진 → 리셔플, 크래시 없음
   deckFactory는 초기 배분(4장)만 제공. 딜러가 11로 히트해야 하므로 소진된 덱에서 draw → 리셔플 */
{
  let threw = null;
  const eng = createTable({
    announce: () => {},
    deckFactory: () => [C('6', 'C'), C('9', 'S'), C('5', 'H'), C('10', 'S')],  // pop: 10(p1a),5(dUp),9(p1b),6(dHole)
    dealerDelay: 5, turnTimeout: 0
  });
  eng.addPlayer('p1', '솔로');
  eng.action('p1', 'start');
  eng.action('p1', 'confirm');
  try { eng.action('p1', 'stand'); } catch (e) { threw = e; }
  await wait(120);
  t.ok('덱 소진에도 예외 없음', threw === null);
  t.ok('라운드 정상 종료(result)', eng.state.phase === 'result');
}

process.exit(t.summary());
