/* highlow.js — 하이·로우 순수 로직 (다음 카드가 현재보다 높은지/낮은지)
   카드 랭크 순위: A(1) < 2 < ... < 10 < J < Q < K(13). 같으면 무승부(칩 유지).
   연승할수록 배당 증가(스트릭). 순수 함수라 단위 테스트 가능. */

import { newDeck, cardNameKo } from './blackjack.js';

export const RANK_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

export function rankOrder(r) { return RANK_ORDER[r]; }
export { cardNameKo };

/* guess: 'high' | 'low'. 반환 outcome: win | lose | tie */
export function judge(current, next, guess) {
  const a = rankOrder(current.r), b = rankOrder(next.r);
  if (b === a) return 'tie';
  const higher = b > a;
  if ((guess === 'high' && higher) || (guess === 'low' && !higher)) return 'win';
  return 'lose';
}

export function freshDeck(rng = Math.random) { return newDeck(rng); }
