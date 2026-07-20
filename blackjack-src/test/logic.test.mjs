/* logic.test.mjs — 블랙잭 순수 로직 단위 테스트 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { makeChecker } = require('./lib/dotpad-mock.cjs');

import { newDeck, handValue, isBlackjack, dealerShouldHit, settle } from '../src/game/blackjack.js';

const t = makeChecker();
const C = (r, s = 'S') => ({ r, s });

console.log('── 블랙잭 로직 테스트 ──');

const deck = newDeck(() => 0.5);
t.ok('덱 52장', deck.length === 52);
t.ok('덱 중복 없음', new Set(deck.map(c => c.r + c.s)).size === 52);

t.ok('A+K = 21 소프트', (() => { const v = handValue([C('A'), C('K')]); return v.total === 21 && v.soft; })());
t.ok('A+A = 12', handValue([C('A'), C('A', 'H')]).total === 12);
t.ok('A+9+5 = 15 (에이스 1)', handValue([C('A'), C('9'), C('5')]).total === 15);
t.ok('A+A+9 = 21', handValue([C('A'), C('A', 'H'), C('9')]).total === 21);
t.ok('K+Q+5 = 25 버스트', handValue([C('K'), C('Q'), C('5')]).total === 25);

t.ok('A+10 블랙잭', isBlackjack([C('A'), C('10')]));
t.ok('A+5+5 = 21이지만 블랙잭 아님', !isBlackjack([C('A'), C('5'), C('5', 'H')]));

t.ok('딜러 16 히트', dealerShouldHit([C('10'), C('6')]));
t.ok('딜러 17 스탠드', !dealerShouldHit([C('10'), C('7')]));
t.ok('딜러 소프트 17 스탠드', !dealerShouldHit([C('A'), C('6')]));

t.ok('블랙잭 1.5배', settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('10'), C('9')] }).payout === 50);
t.ok('양쪽 블랙잭 = 푸시', settle({ bet: 20, player: [C('A'), C('K')], dealer: [C('A', 'H'), C('Q', 'H')] }).payout === 20);
t.ok('승리 2배', settle({ bet: 20, player: [C('10'), C('9')], dealer: [C('10', 'H'), C('8')] }).payout === 40);
t.ok('딜러 버스트 = 승리', settle({ bet: 20, player: [C('10'), C('6')], dealer: [C('10', 'H'), C('6', 'H'), C('K', 'H')] }).outcome === 'win');
t.ok('패배 0', settle({ bet: 20, player: [C('10'), C('8')], dealer: [C('10', 'H'), C('9')] }).payout === 0);
t.ok('푸시 반환', settle({ bet: 20, player: [C('10'), C('9')], dealer: [C('10', 'H'), C('9', 'H')] }).payout === 20);
t.ok('플레이어 버스트', settle({ bet: 20, player: [C('10'), C('9'), C('5')], dealer: [C('2'), C('3')] }).outcome === 'bust');
t.ok('딜러 블랙잭 = 패배', settle({ bet: 20, player: [C('10'), C('9')], dealer: [C('A', 'H'), C('K', 'H')] }).outcome === 'lose');

process.exit(t.summary());
