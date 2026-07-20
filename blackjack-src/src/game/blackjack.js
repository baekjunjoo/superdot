/* blackjack.js — 순수 게임 로직 (DOM/BLE 무관, 단위 테스트 가능) */

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_KO = { S: '스페이드', H: '하트', D: '다이아', C: '클로버' };
export const RANK_KO = { A: '에이스', J: '잭', Q: '퀸', K: '킹' };

export function cardNameKo(c) {
  return SUIT_KO[c.s] + ' ' + (RANK_KO[c.r] || c.r);
}

export function newDeck(rng = Math.random) {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  // Fisher–Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  return deck;
}

export function cardValue(r) {
  if (r === 'A') return 11;
  if (r === 'J' || r === 'Q' || r === 'K') return 10;
  return parseInt(r, 10);
}

/* 에이스 11/1 자동 처리. soft = 에이스를 11로 세고 있는 상태 */
export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c.r); if (c.r === 'A') aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards) {
  return handValue(cards).total > 21;
}

/* 딜러 규칙: 16 이하 히트, 17 이상 스탠드 (소프트 17 스탠드) */
export function dealerShouldHit(cards) {
  return handValue(cards).total < 17;
}

/* 정산. delta = 칩 증감 (베팅은 이미 차감된 상태 기준: 반환액 - 0)
   반환값 outcome: blackjack | win | push | lose | bust
   payout: 라운드 종료 시 플레이어에게 돌려줄 칩(베팅 포함)
   playerNatural: 스플릿하지 않은 원 핸드만 '내추럴 블랙잭'(1.5배) 인정.
     스플릿 후 두 장 21은 일반 승리로 처리한다. */
export function settle({ bet, player, dealer, playerNatural = true }) {
  const pv = handValue(player).total;
  const dv = handValue(dealer).total;
  const pBJ = playerNatural && isBlackjack(player);
  const dBJ = isBlackjack(dealer);
  if (pv > 21) return { outcome: 'bust', payout: 0 };
  if (pBJ && !dBJ) return { outcome: 'blackjack', payout: bet + Math.floor(bet * 1.5) };
  if (dBJ && pBJ) return { outcome: 'push', payout: bet };
  if (dBJ && !pBJ) return { outcome: 'lose', payout: 0 };
  if (dv > 21) return { outcome: 'win', payout: bet * 2 };
  if (pv > dv) return { outcome: 'win', payout: bet * 2 };
  if (pv < dv) return { outcome: 'lose', payout: 0 };
  return { outcome: 'push', payout: bet };
}
