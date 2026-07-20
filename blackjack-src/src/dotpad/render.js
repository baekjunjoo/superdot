/* render.js — 게임 상태 → 촉각 프레임(60×40) + 텍스트라인(20셀)
   레이아웃: 위 = 딜러, 아래 = 플레이어, 가운데 점선 구분선 (인트로 음성으로 안내)
   카드 = 9×13 외곽선 + 중앙 랭크 글리프. 딜러 홀카드 = X 패턴 */

import { createFrame, clearBuf, rect, line, dashedHLine, drawGlyph, drawText, textWidth, encodeRows, W } from './frame.js';
import { strToTextCells } from './braille-core.js';
import { handValue } from '../game/blackjack.js';
import { getPrefs } from '../prefs.js';

const CARD_W = 9, CARD_H = 13, PITCH = 10;
const DEALER_Y = 1, PLAYER_Y = 26, DIVIDER_Y = 19;

function drawCard(buf, x, y, card, hidden) {
  rect(buf, x, y, CARD_W, CARD_H);
  if (hidden || card.hidden) {
    line(buf, x + 2, y + 2, x + CARD_W - 3, y + CARD_H - 3);
    line(buf, x + CARD_W - 3, y + 2, x + 2, y + CARD_H - 3);
    return;
  }
  if (card.r === '10') {
    // 두 자리: 3×5 폰트 세로 2배(3×10) 두 개
    drawGlyph(buf, '1', x + 1, y + 2, 1, 2);
    drawGlyph(buf, '0', x + 5, y + 2, 1, 2);
  } else {
    // 한 자리: 2배 확대(6×10) 중앙
    drawGlyph(buf, card.r, x + 2, y + 2, 2, 2);
  }
}

function drawHand(buf, cards, y, hideHole) {
  // 최대 6장 표시(초과 시 마지막 6장)
  const shown = cards.slice(-6);
  const offset = cards.length - shown.length;
  shown.forEach((c, i) => {
    const hidden = hideHole && (offset + i) === 1; // 딜러 2번째 카드 = 홀카드
    drawCard(buf, i * PITCH, y, c, hidden);
  });
}

/* 텍스트라인: 20셀 바이트 → hex 40자 (점역, 부족분 0 패딩) */
export function textLineHex(str) {
  const cells = strToTextCells(str);
  let hex = '';
  for (let i = 0; i < 20; i++) {
    const b = cells[i] || 0;
    const h = b.toString(16).toUpperCase();
    hex += (h.length < 2 ? '0' : '') + h;
  }
  return hex;
}

export function statusText(st) {
  const ko = getPrefs().brailleKo;
  const pv = st.player.length ? handValue(st.player).total : 0;
  const dUp = st.dealer.length ? handValue(st.hideHole ? [st.dealer[0]] : st.dealer).total : 0;
  switch (st.phase) {
    case 'bet': return ko ? '베팅 ' + st.bet + ' 칩 ' + st.chips : 'bet ' + st.bet + ' chips ' + st.chips;
    case 'player': return ko ? '나 ' + pv + ' 딜러 ' + dUp : 'you ' + pv + ' dealer ' + dUp;
    case 'dealer': return (ko ? '딜러 ' : 'dealer ') + dUp;
    case 'result': {
      const o = st.result ? st.result.outcome : '';
      const en = { blackjack: 'bj', win: 'win', push: 'push', lose: 'lose', bust: 'bust' };
      const kow = { blackjack: '블랙잭', win: '승', push: '무', lose: '패', bust: '버스트' };
      return ((ko ? kow[o] : en[o]) || o) + (ko ? ' 칩 ' : ' chips ') + st.chips;
    }
    case 'over': return ko ? '게임 끝 에프1 새게임' : 'game over f1 new';
    default: return ko ? '블랙잭' : 'blackjack';
  }
}

/* ── 멀티플레이: 방 공개 상태 + 내 ID → 내 시점 촉각 프레임 ──
   내 카드 + 딜러만 표시(다른 플레이어는 음성·화면으로) */
export function roomStatusText(st, myId) {
  const ko = getPrefs().brailleKo;
  const score = st.opts && st.opts.scoreMode;
  const CH = score ? (ko ? '점수' : 'pts') : (ko ? '칩' : 'chips');
  const me = st.players.find((p) => p.id === myId);
  if (!me) return ko ? '관전' : 'watching';
  const shown = st.dealer.filter((c) => !c.hidden);
  const dv = shown.length ? handValue(shown).total : 0;
  const pv = me.cards.length ? handValue(me.cards).total : 0;
  switch (st.phase) {
    case 'lobby': return ko ? '대기 ' + st.players.length + '명' : 'room wait ' + st.players.length + 'p';
    case 'betting':
      if (me.sitOut) return ko ? '관전 ' + CH + ' 0' : 'sit out ' + CH + ' 0';
      return ko ? '베팅 ' + me.bet + ' ' + CH + ' ' + me.chips : 'bet ' + me.bet + ' ' + CH + ' ' + me.chips;
    case 'acting': {
      const mine = st.turnId === myId;
      const hand2 = me.hands && me.hands.length > 1 ? (ko ? ' 핸드' + (me.activeHand + 1) : ' h' + (me.activeHand + 1)) : '';
      return (ko ? (mine ? '나 ' : '대기 ') : (mine ? 'you ' : 'wait ')) + pv + (ko ? ' 딜러 ' : ' dealer ') + dv + hand2;
    }
    case 'dealer': return (ko ? '딜러 ' : 'dealer ') + dv;
    case 'result': {
      const en = { blackjack: 'bj', win: 'win', push: 'push', lose: 'lose', bust: 'bust' };
      const kow = { blackjack: '블랙잭', win: '승', push: '무', lose: '패', bust: '버스트' };
      const outcomes = (me.results && me.results.length ? me.results : [me.result]).filter(Boolean);
      const word = outcomes.map((o) => (ko ? kow[o] : en[o]) || '').join(' ');
      return (word || (ko ? '끝' : 'done')) + ' ' + CH + ' ' + me.chips;
    }
    default: return ko ? '블랙잭' : 'blackjack';
  }
}

export function renderRoom(st, myId) {
  const buf = createFrame();
  clearBuf(buf);
  const me = st.players.find((p) => p.id === myId);

  if (!me || st.phase === 'lobby' || st.phase === 'betting') {
    const label = me && !me.sitOut && st.phase === 'betting' ? String(me.bet) : String(st.players.length) ;
    const sx = 3, sy = 3;
    const tw = textWidth(label, sx);
    drawText(buf, label, Math.max(0, Math.floor((W - tw) / 2)), 6, sx, sy);
    if (me) {
      const g = Math.max(0, Math.min(58, Math.round(me.chips / 5)));
      rect(buf, 0, 30, 60, 1, { fill: true });
      if (g > 0) rect(buf, 1, 32, g, 4, { fill: true });
    }
  } else {
    drawHand(buf, st.dealer, DEALER_Y, false);      // hidden 카드는 카드 객체에 표시됨
    dashedHLine(buf, DIVIDER_Y);
    dashedHLine(buf, DIVIDER_Y + 1);
    drawHand(buf, me.cards, PLAYER_Y, false);
    if (st.phase === 'acting' && st.turnId === myId) {
      // 내 차례 표시: 좌우 가장자리 세로 굵은 띄 (촉각 신호)
      rect(buf, 0, 22, 2, 16, { fill: true });
      rect(buf, 58, 22, 2, 16, { fill: true });
    }
  }
  return { buf, rows: encodeRows(buf), textHex: textLineHex(roomStatusText(st, myId)) };
}

export function renderGame(st) {
  const buf = createFrame();
  clearBuf(buf);

  if (st.phase === 'bet' || st.phase === 'over') {
    // 베팅 화면: 큰 베팅 숫자 + 칩 게이지
    const label = st.phase === 'over' ? '0' : String(st.bet);
    const sx = 3, sy = 3;
    const tw = textWidth(label, sx);
    drawText(buf, label, Math.max(0, Math.floor((W - tw) / 2)), 6, sx, sy);
    // 칩 게이지: 칩 5개당 1픽셀 (최대 58)
    const g = Math.max(0, Math.min(58, Math.round(st.chips / 5)));
    rect(buf, 0, 30, 60, 1, { fill: true });          // 게이지 바닥선
    if (g > 0) rect(buf, 1, 32, g, 4, { fill: true }); // 게이지
  } else {
    drawHand(buf, st.dealer, DEALER_Y, st.hideHole);
    dashedHLine(buf, DIVIDER_Y);
    dashedHLine(buf, DIVIDER_Y + 1);
    drawHand(buf, st.player, PLAYER_Y, false);
    if (st.pulse) {
      // 승리 축하 펄스: 화면 테두리 2겹 (카드는 유지)
      rect(buf, 0, 0, 60, 40);
      rect(buf, 1, 1, 58, 38);
    }
  }

  return { buf, rows: encodeRows(buf), textHex: textLineHex(statusText(st)) };
}
