/* controller.js — 블랙잭 상태 머신 + 키 라우팅 + 음성/렌더 오케스트레이션 (연습 모드)
   tactile-ux 철칙 준수:
   - 무음 금지: 모든 상태 변화·키 입력에 즉각 음성 (무시되는 키도 안내)
   - 삼중 피드백: 음성(주) + 텍스트라인(확인) + 촉각 그래픽(공간)
   - 파괴적 동작(새 게임)은 2단계 확인(4초 내 재입력)
   - F4 = 상태 다시 읽기 (항상 유지) */

import * as BJ from './blackjack.js';
import { renderGame, statusText } from '../dotpad/render.js';

const BET_OPTIONS = [10, 25, 50, 100];
const START_CHIPS = 100;

export function createGame({ say, rng = Math.random, deckFactory = null, dealerDelay = 900 } = {}) {
  const listeners = new Set();
  let confirmT = null; // 2단계 확인 타이머

  const st = {
    phase: 'bet',           // bet | player | dealer | result | over
    chips: START_CHIPS,
    bet: 25, betIdx: 1,
    deck: [], player: [], dealer: [],
    hideHole: true,
    result: null,
    doubled: false,
    confirmNew: false,
    pulse: false
  };

  function speak(txt) { if (say) say(txt); }
  function emit() { listeners.forEach((fn) => fn(st)); }
  function update() { emit(); }

  function handKo(cards) {
    return cards.map(BJ.cardNameKo).join(', ');
  }
  function valueKo(cards) {
    const v = BJ.handValue(cards);
    return v.total + (v.soft ? ' (소프트)' : '');
  }

  function readStatus() {
    if (st.phase === 'bet') {
      speak('베팅 ' + st.bet + ', 보유 칩 ' + st.chips + '. 팬 키로 조절, 에프1 확정.');
    } else if (st.phase === 'player') {
      speak('당신 카드 ' + handKo(st.player) + ', 합계 ' + valueKo(st.player) +
        '. 딜러 오픈 카드 ' + BJ.cardNameKo(st.dealer[0]) +
        '. 에프1 히트, 에프2 스탠드' + (canDouble() ? ', 에프3 더블다운' : '') + '.');
    } else if (st.phase === 'dealer') {
      speak('딜러 차례입니다. 잠시만요.');
    } else if (st.phase === 'result') {
      speak(resultKo() + ' 보유 칩 ' + st.chips + '. 에프1 다음 판.');
    } else if (st.phase === 'over') {
      speak('칩을 모두 잃었습니다. 에프1을 두 번 누르면 새 게임을 시작합니다.');
    }
  }

  function resultKo() {
    const o = st.result && st.result.outcome;
    const dv = BJ.handValue(st.dealer).total;
    const pv = BJ.handValue(st.player).total;
    const base = '당신 ' + pv + ', 딜러 ' + dv + '. ';
    switch (o) {
      case 'blackjack': return '블랙잭! ' + (st.bet + Math.floor(st.bet * 1.5)) + ' 칩 획득.';
      case 'win': return base + '당신의 승리! ' + st.bet * 2 + ' 칩 획득.';
      case 'push': return base + '무승부. 베팅 ' + st.bet + ' 칩 반환.';
      case 'lose': return base + '딜러 승. ' + st.bet + ' 칩 잃음.';
      case 'bust': return '버스트! 합계 ' + pv + '. ' + st.bet + ' 칩 잃음.';
      default: return '';
    }
  }

  /* 승리 축하 촉각 펄스: 화면 테두리 400ms 점멸 2회 (카드 유지) */
  function doPulse() {
    let n = 0;
    const it = setInterval(() => {
      st.pulse = !st.pulse;
      update();
      if (++n >= 4) { clearInterval(it); st.pulse = false; update(); }
    }, 400);
  }

  function explainRules() {
    speak('블랙잭 규칙. 카드 합이 21에 가까우면 이깁니다. 21을 넘으면 버스트로 패배. ' +
      '에이스는 1 또는 11, 그림 카드는 10. 딜러는 16 이하면 카드를 더 받고 17이면 멈춥니다. ' +
      '블랙잭은 첫 두 장으로 21, 베팅의 1.5배를 받습니다. ' +
      '히트는 카드 추가, 스탠드는 멈춤, 더블다운은 베팅을 두 배로 올리고 한 장만 더 받는 것입니다.');
  }

  function canDouble() {
    return st.phase === 'player' && st.player.length === 2 && st.chips >= st.bet;
  }

  function betOptions() {
    const opts = BET_OPTIONS.filter((b) => b <= st.chips);
    return opts.length ? opts : [st.chips]; // 최소한 올인 옵션
  }

  function adjustBet(dir) {
    const opts = betOptions();
    let i = opts.indexOf(st.bet);
    if (i < 0) i = 0;
    i = (i + dir + opts.length) % opts.length;
    st.bet = opts[i];
    speak('베팅 ' + st.bet);
    update();
  }

  function deal() {
    if (st.bet > st.chips) { st.bet = betOptions()[0]; }
    st.chips -= st.bet;
    st.deck = deckFactory ? deckFactory() : BJ.newDeck(rng);
    // 표준 배분 순서: 플레이어1 → 딜러1 → 플레이어2 → 딜러2(홀카드)
    const p1 = st.deck.pop(), d1 = st.deck.pop(), p2 = st.deck.pop(), d2 = st.deck.pop();
    st.player = [p1, p2]; st.dealer = [d1, d2];
    st.hideHole = true;
    st.doubled = false;
    st.result = null;

    if (BJ.isBlackjack(st.player)) {
      st.hideHole = false;
      st.result = BJ.settle({ bet: st.bet, player: st.player, dealer: st.dealer });
      st.chips += st.result.payout;
      st.phase = 'result';
      speak('배분. 당신 카드 ' + handKo(st.player) + '. ' + resultKo() + ' 에프1 다음 판.');
      if (st.result.outcome === 'blackjack') doPulse();
    } else {
      st.phase = 'player';
      speak('배분. 당신 카드 ' + handKo(st.player) + ', 합계 ' + valueKo(st.player) +
        '. 딜러 오픈 카드 ' + BJ.cardNameKo(st.dealer[0]) +
        '. 에프1 히트, 에프2 스탠드' + (canDouble() ? ', 에프3 더블다운' : '') + '.');
    }
    update();
  }

  function hit(isDouble) {
    const c = st.deck.pop();
    st.player.push(c);
    const v = BJ.handValue(st.player);
    if (v.total > 21) {
      st.hideHole = false;
      st.result = BJ.settle({ bet: st.bet, player: st.player, dealer: st.dealer });
      st.phase = 'result';
      speak(BJ.cardNameKo(c) + '. ' + resultKo() + ' 보유 칩 ' + st.chips + '. 에프1 다음 판.');
      checkOver();
    } else if (isDouble || v.total === 21) {
      speak(BJ.cardNameKo(c) + ', 합계 ' + valueKo(st.player) + '. 딜러 차례.');
      dealerPlay();
    } else {
      speak(BJ.cardNameKo(c) + ', 합계 ' + valueKo(st.player) + '.');
    }
    update();
  }

  function dealerPlay() {
    st.phase = 'dealer';
    st.hideHole = false;
    speak('딜러 카드 공개. ' + handKo(st.dealer) + ', 합계 ' + valueKo(st.dealer) + '.');
    update();
    const step = () => {
      if (BJ.dealerShouldHit(st.dealer)) {
        const c = st.deck.pop();
        st.dealer.push(c);
        const v = BJ.handValue(st.dealer);
        speak('딜러 ' + BJ.cardNameKo(c) + ', 합계 ' + v.total + (v.total > 21 ? '. 딜러 버스트!' : '.'));
        update();
        setTimeout(step, dealerDelay);
      } else {
        st.result = BJ.settle({ bet: st.bet, player: st.player, dealer: st.dealer });
        st.chips += st.result.payout;
        st.phase = 'result';
        speak(resultKo() + ' 보유 칩 ' + st.chips + '. 에프1 다음 판.');
        update();
        if (st.result.outcome === 'win') doPulse();
        checkOver();
      }
    };
    setTimeout(step, dealerDelay);
  }

  function checkOver() {
    if (st.phase === 'result' && st.chips <= 0) {
      st.phase = 'over';
      speak('칩을 모두 잃었습니다. 게임 오버. 에프1을 두 번 누르면 새 게임.');
      update();
    }
  }

  function nextRound() {
    st.phase = 'bet';
    st.player = []; st.dealer = []; st.result = null;
    const opts = betOptions();
    if (!opts.includes(st.bet)) st.bet = opts[opts.length - 1];
    speak('베팅 ' + st.bet + ', 보유 칩 ' + st.chips + '. 팬 키로 조절, 에프1 확정.');
    update();
  }

  function newGame() {
    st.chips = START_CHIPS; st.bet = 25;
    st.confirmNew = false;
    nextRound();
    speak('새 게임. 칩 ' + START_CHIPS + '개로 시작합니다.');
  }

  /* ── 키 라우팅 (F4 = 항상 상태 읽기) ── */
  function onKey(k) {
    if (k === 'F4') { readStatus(); return; }

    if (st.phase === 'bet') {
      if (k === 'PAN_RIGHT') return adjustBet(1);
      if (k === 'PAN_LEFT') return adjustBet(-1);
      if (k === 'F1') return deal();
      if (k === 'F2') return explainRules();
      speak('베팅 단계입니다. 팬 키로 조절, 에프1 확정, 에프2 규칙 설명.');
    } else if (st.phase === 'player') {
      if (k === 'F1') return hit(false);
      if (k === 'F2') { speak('스탠드.'); return dealerPlay(); }
      if (k === 'F3') {
        if (!canDouble()) { speak('더블다운은 첫 두 장에서 칩이 충분할 때만 가능합니다.'); return; }
        st.chips -= st.bet; st.bet *= 2; st.doubled = true;
        speak('더블다운. 베팅 ' + st.bet + '. 카드 한 장.');
        return hit(true);
      }
      speak('에프1 히트, 에프2 스탠드' + (canDouble() ? ', 에프3 더블다운' : '') + '.');
    } else if (st.phase === 'dealer') {
      speak('잠시만요. 딜러가 카드를 뽑는 중입니다.');
    } else if (st.phase === 'result') {
      if (k === 'F1') return nextRound();
      speak('에프1을 누르면 다음 판을 시작합니다.');
    } else if (st.phase === 'over') {
      if (k === 'F1') {
        if (st.confirmNew) { clearTimeout(confirmT); return newGame(); }
        st.confirmNew = true;
        speak('새 게임을 시작하려면 4초 안에 에프1을 한 번 더 누르세요.');
        confirmT = setTimeout(() => { st.confirmNew = false; }, 4000);
        return;
      }
      speak('게임 오버. 에프1을 두 번 누르면 새 게임.');
    }
  }

  function intro() {
    speak('블랙잭. 위쪽이 딜러, 아래쪽이 당신의 카드입니다. 엑스 표시 카드는 아직 뒤집힌 딜러의 카드입니다. ' +
      '팬 키로 베팅 조절, 에프1 베팅 확정. 게임 중 에프1 히트, 에프2 스탠드, 에프3 더블다운, 에프4 상태 읽기. ' +
      '베팅 ' + st.bet + ', 보유 칩 ' + st.chips + '.');
  }

  return {
    state: st,
    onKey,
    intro,
    readStatus,
    frame: () => renderGame(st),
    status: () => statusText(st),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
