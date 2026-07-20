/* table.js — 다인 블랙잭 테이블 엔진 (호스트 권위)
   스플릿·턴타이머·관전·이모트·점수모드·라운드요약·방설정 + 인슈어런스(딜러 오픈 A)
   announce(text, to, kind): to=null(전원)|id|{except:id}, kind='others'|'emote' */

import * as BJ from './blackjack.js';
import { MAX_SEATS, START_CHIPS } from '../config.js';

const BET_OPTIONS = [10, 25, 50, 100];
export const EMOTES = ['나이스!', '굿 게임!', '아깝다!', '조심하세요~', '서둘러 주세요!', 'ㅋㅋㅋ'];

export function createTable({ announce = () => {}, onState = () => {}, rng = Math.random, deckFactory = null, dealerDelay = 900, turnTimeout = 30000, scoreMode = false } = {}) {
  const T = {
    phase: 'lobby',          // lobby | betting | insurance | acting | dealer | result
    players: [],
    spectators: [],
    dealer: [], deck: [],
    hideHole: true,
    turnId: null,
    round: 0, seq: 0,
    opts: { dealerDelay, turnTimeout, scoreMode }
  };
  let turnTimer = null, warnTimer = null;

  function term(text) {
    return T.opts.scoreMode ? text.replace(/베팅/g, '점수').replace(/칩/g, '점수') : text;
  }
  function A(text, to, kind) { announce(term(text), to === undefined ? null : to, kind); }

  function emit() { T.seq++; onState(publicState()); }

  function publicState() {
    return {
      phase: T.phase, round: T.round, seq: T.seq, turnId: T.turnId, hideHole: T.hideHole,
      opts: { ...T.opts },
      dealer: T.dealer.map((c, i) => (T.hideHole && i === 1 ? { hidden: true } : c)),
      spectators: T.spectators.map((s) => ({ id: s.id, nick: s.nick })),
      players: T.players.map((p) => ({
        id: p.id, nick: p.nick, chips: p.chips,
        bet: p.handBets.length ? p.handBets.reduce((a, b) => a + b, 0) : p.bet,
        betConfirmed: p.betConfirmed,
        cards: p.hands[p.activeHand] || p.hands[0] || [],
        hands: p.hands, activeHand: p.activeHand,
        done: p.done,
        result: p.results.length === 1 ? p.results[0].outcome : null,
        results: p.results.map((r) => r.outcome),
        ready: p.ready, sitOut: p.sitOut,
        insBet: p.insBet || 0, insDecided: !!p.insDecided
      }))
    };
  }

  function find(id) { return T.players.find((p) => p.id === id); }
  function findSpec(id) { return T.spectators.find((s) => s.id === id); }
  function isHost(id) { return T.players[0] && T.players[0].id === id; }
  function active() { return T.players.filter((p) => !p.sitOut && p.handBets.length > 0); }
  function handKo(cards) { return cards.map(BJ.cardNameKo).join(', '); }
  function vKo(cards) { const v = BJ.handValue(cards); return v.total + (v.soft ? ' 소프트' : ''); }

  function freshHand(p) {
    p.insBet = 0; p.insDecided = false; p.insWon = false;
    p.hands = []; p.handBets = []; p.handDone = []; p.activeHand = 0;
    p.done = false; p.results = []; p.ready = false;
  }

  /* ── 입장/퇴장/관전 ── */
  function addPlayer(id, nick) {
    const existing = find(id) || findSpec(id);
    if (existing) { A(existing.nick + ' 님이 재접속했습니다.'); emit(); return true; }
    if (T.players.length >= MAX_SEATS) {
      T.spectators.push({ id, nick });
      A(nick + ' 님이 관전으로 입장했습니다. 자리가 나면 자동으로 참가합니다.');
      A('자리가 가득 차 관전으로 입장했습니다. 게임 진행이 음성으로 중계됩니다.', id);
      emit();
      return true;
    }
    const sitOut = T.phase !== 'lobby' && T.phase !== 'betting';
    const p = { id, nick, chips: START_CHIPS, bet: 25, betConfirmed: false, sitOut, _emoteAt: 0 };
    freshHand(p);
    T.players.push(p);
    A(nick + ' 님이 입장했습니다.' + (sitOut ? ' 다음 판부터 참가합니다.' : ''));
    if (T.phase === 'betting' && !sitOut) A('베팅을 정하고 확정해 주세요.', id);
    emit();
    return true;
  }

  function removePlayer(id) {
    const s = findSpec(id);
    if (s) { T.spectators = T.spectators.filter((x) => x.id !== id); A(s.nick + ' 님(관전)이 나갔습니다.'); emit(); return; }
    const p = find(id);
    if (!p) return;
    T.players = T.players.filter((x) => x.id !== id);
    A(p.nick + ' 님이 나갔습니다.');
    promoteSpectators();
    if (T.phase === 'acting' && T.turnId === id) advanceTurn();
    else if (T.phase === 'betting') checkAllConfirmed();
    else if (T.phase === 'insurance') { if (allInsDecided()) resolveInsurance(); }
    else if (T.phase === 'result') checkAllReady();
    emit();
  }

  function promoteSpectators() {
    while (T.players.length < MAX_SEATS && T.spectators.length) {
      const s = T.spectators.shift();
      const p = { id: s.id, nick: s.nick, chips: START_CHIPS, bet: 25, betConfirmed: false, sitOut: T.phase !== 'lobby' && T.phase !== 'betting', _emoteAt: 0 };
      freshHand(p);
      T.players.push(p);
      A(s.nick + ' 님이 관전에서 참가로 전환되었습니다.');
      A('자리가 나서 참가로 전환되었습니다.' + (p.sitOut ? ' 다음 판부터 참가합니다.' : ''), s.id);
    }
  }

  /* ── 라운드 ── */
  function startBetting() {
    clearTurnTimer();
    T.phase = 'betting';
    T.round++;
    T.dealer = []; T.turnId = null; T.hideHole = true;
    promoteSpectators();
    T.players.forEach((p) => {
      freshHand(p);
      p.sitOut = p.chips <= 0;
      p.betConfirmed = false;
      if (!p.sitOut && p.bet > p.chips) p.bet = betOptions(p)[0];
      if (p.sitOut) A('칩이 없어 이번 판은 관전합니다.', p.id);
    });
    A(T.round + '라운드. 베팅을 정하고 확정해 주세요. 팬 키로 조절, 에프1 확정.');
    emit();
  }

  function betOptions(p) {
    const o = BET_OPTIONS.filter((b) => b <= p.chips);
    return o.length ? o : [p.chips];
  }

  function adjustBet(p, dir) {
    const opts = betOptions(p);
    let i = opts.indexOf(p.bet); if (i < 0) i = 0;
    p.bet = opts[(i + dir + opts.length) % opts.length];
    A('베팅 ' + p.bet, p.id);
    emit();
  }

  function checkAllConfirmed() {
    const bettors = T.players.filter((p) => !p.sitOut);
    if (bettors.length && bettors.every((p) => p.betConfirmed)) deal();
  }

  function deal() {
    T.phase = 'acting';
    T.deck = deckFactory ? deckFactory() : BJ.newDeck(rng);
    const bettors = T.players.filter((p) => !p.sitOut);
    bettors.forEach((p) => {
      p.chips -= p.bet;
      p.handBets = [p.bet]; p.hands = [[T.deck.pop()]]; p.handDone = [false]; p.activeHand = 0;
    });
    T.dealer = [T.deck.pop()];
    bettors.forEach((p) => { p.hands[0].push(T.deck.pop()); });
    T.dealer.push(T.deck.pop());
    T.hideHole = true;

    A('카드 배분. 딜러 오픈 카드 ' + BJ.cardNameKo(T.dealer[0]) + '.');
    bettors.forEach((p) => {
      A('당신 카드 ' + handKo(p.hands[0]) + ', 합계 ' + vKo(p.hands[0]) + '.', p.id);
      if (BJ.isBlackjack(p.hands[0])) { p.handDone[0] = true; p.done = true; A('블랙잭!', p.id); A(p.nick + ' 님 블랙잭!', { except: p.id }, 'others'); }
    });
    if (T.dealer[0].r === 'A') { startInsurance(bettors); return; }
    T.turnId = null;
    advanceTurn();
    emit();
  }

  /* ── 인슈어런스(딜러 오픈 A) ── */
  function startInsurance(bettors) {
    T.phase = 'insurance';
    T.turnId = null;
    bettors.forEach((p) => {
      p.insDecided = p.chips < Math.ceil(p.bet / 2);
      if (p.insDecided) A('보험을 걸 칩이 부족해 자동 패스합니다.', p.id);
    });
    A('딜러 오픈 카드가 에이스입니다. 보험을 거시겠어요? 에프1 보험(베팅의 절반), 에프2 패스.');
    if (allInsDecided()) return resolveInsurance();
    emit();
  }
  function allInsDecided() { return active().every((p) => p.insDecided); }
  function resolveInsurance() {
    const dealerBJ = BJ.isBlackjack(T.dealer);
    if (dealerBJ) {
      T.hideHole = false;
      active().forEach((p) => { if (p.insBet > 0) { p.chips += p.insBet * 3; p.insWon = true; } });
      A('딜러 블랙잭! 보험을 건 분은 보험금 지급, 원 베팅은 정산됩니다.');
      settleAll();
      return;
    }
    A('딜러는 블랙잭이 아닙니다. 보험은 무효, 게임을 계속합니다.');
    T.phase = 'acting';
    T.turnId = null;
    advanceTurn();
    emit();
  }

  function nextHand(p) {
    const idx = p.handDone.findIndex((d) => !d);
    if (idx === -1) { p.done = true; return false; }
    if (idx !== p.activeHand) {
      p.activeHand = idx;
      A('다음 핸드. 카드 ' + handKo(p.hands[idx]) + ', 합계 ' + vKo(p.hands[idx]) + '.', p.id);
    }
    return true;
  }

  function clearTurnTimer() {
    if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
    if (warnTimer) { clearTimeout(warnTimer); warnTimer = null; }
  }

  function armTurnTimer(p) {
    clearTurnTimer();
    const ms = T.opts.turnTimeout;
    if (!ms || ms <= 0) return;
    if (ms > 12000) {
      warnTimer = setTimeout(() => { if (T.turnId === p.id) A('10초 남았습니다.', p.id); }, ms - 10000);
    }
    turnTimer = setTimeout(() => {
      if (T.phase !== 'acting' || T.turnId !== p.id) return;
      A('시간 초과. 자동 스탠드합니다.', p.id);
      A(p.nick + ' 님 시간 초과, 자동 스탠드.', { except: p.id }, 'others');
      doStand(p);
    }, ms);
  }

  function advanceTurn() {
    clearTurnTimer();
    const order = active();
    const cur = T.turnId ? find(T.turnId) : null;
    let turn = null;
    if (cur && !cur.done && order.includes(cur)) turn = cur;
    else {
      const start = cur ? order.indexOf(cur) + 1 : 0;
      turn = order.slice(start).find((p) => !p.done) || null;
    }
    if (turn) {
      T.turnId = turn.id;
      nextHand(turn);
      if (turn.done) return advanceTurn();
      A('당신 차례입니다. 에프1 히트, 에프2 스탠드' + (canDouble(turn) ? ', 에프3 더블다운' : '') + (canSplit(turn) ? ', 팬 오른쪽 스플릿' : '') + '.', turn.id);
      A(turn.nick + ' 님 차례.', { except: turn.id }, 'others');
      armTurnTimer(turn);
      emit();
    } else {
      T.turnId = null;
      dealerPlay();
    }
  }

  function canDouble(p) {
    return p.hands[p.activeHand] && p.hands[p.activeHand].length === 2 && p.chips >= p.handBets[p.activeHand];
  }
  function canSplit(p) {
    const h = p.hands[p.activeHand];
    return p.hands.length === 1 && h && h.length === 2 && h[0].r === h[1].r && p.chips >= p.handBets[0];
  }

  function doHit(p, isDouble) {
    const i = p.activeHand;
    const c = T.deck.pop();
    p.hands[i].push(c);
    const v = BJ.handValue(p.hands[i]);
    A('카드 ' + BJ.cardNameKo(c) + ', 합계 ' + vKo(p.hands[i]) + (v.total > 21 ? '. 버스트!' : '.'), p.id);
    A(p.nick + ' 님 ' + BJ.cardNameKo(c) + (v.total > 21 ? ', 버스트.' : '.'), { except: p.id }, 'others');
    if (v.total >= 21 || isDouble) {
      p.handDone[i] = true;
      if (!nextHand(p)) advanceTurn();
      else { armTurnTimer(p); }
    } else {
      armTurnTimer(p);
    }
    emit();
  }

  function doStand(p) {
    p.handDone[p.activeHand] = true;
    if (!nextHand(p)) advanceTurn();
    else armTurnTimer(p);
    emit();
  }

  function doSplit(p) {
    const [c1, c2] = p.hands[0];
    p.chips -= p.handBets[0];
    p.hands = [[c1], [c2]];
    p.handBets = [p.handBets[0], p.handBets[0]];
    p.handDone = [false, false];
    p.activeHand = 0;
    p.hands[0].push(T.deck.pop());
    p.hands[1].push(T.deck.pop());
    A('스플릿. 첫 핸드 ' + handKo(p.hands[0]) + ', 합계 ' + vKo(p.hands[0]) + '.', p.id);
    A(p.nick + ' 님 스플릿.', { except: p.id }, 'others');
    if (BJ.handValue(p.hands[0]).total >= 21) { p.handDone[0] = true; if (!nextHand(p)) return advanceTurn(); }
    armTurnTimer(p);
    emit();
  }

  function dealerPlay() {
    clearTurnTimer();
    T.phase = 'dealer';
    T.hideHole = false;
    A('딜러 카드 공개. ' + handKo(T.dealer) + ', 합계 ' + BJ.handValue(T.dealer).total + '.');
    emit();
    const step = () => {
      if (BJ.dealerShouldHit(T.dealer)) {
        const c = T.deck.pop();
        T.dealer.push(c);
        const v = BJ.handValue(T.dealer);
        A('딜러 ' + BJ.cardNameKo(c) + ', 합계 ' + v.total + (v.total > 21 ? '. 딜러 버스트!' : '.'));
        emit();
        setTimeout(step, T.opts.dealerDelay);
      } else settleAll();
    };
    setTimeout(step, T.opts.dealerDelay);
  }

  const RESULT_KO = { blackjack: '블랙잭', win: '승리', push: '무승부', lose: '패배', bust: '버스트' };

  function settleAll() {
    T.phase = 'result';
    const lines = [];
    active().forEach((p) => {
      p.results = p.hands.map((h, i) => BJ.settle({ bet: p.handBets[i], player: h, dealer: T.dealer }));
      const total = p.results.reduce((a, r) => a + r.payout, 0);
      p.chips += total;
      const words = p.results.map((r) => RESULT_KO[r.outcome]).join(', ');
      A(words + (total > 0 ? '. ' + total + ' 칩 획득' : '') + '. 보유 칩 ' + p.chips + '. 에프1 준비.', p.id);
      lines.push(p.nick + ' ' + words);
    });
    if (lines.length) A('라운드 결과 요약. ' + lines.join('. ') + '.', undefined, 'others');
    const standing = T.players.filter((p) => p.chips > 0).length;
    if (!standing) A('모든 플레이어의 칩이 소진되었습니다. 호스트가 새 게임을 시작할 수 있습니다.');
    emit();
  }

  function checkAllReady() {
    const alive = T.players.filter((p) => p.chips > 0);
    if (alive.length && alive.every((p) => p.ready || p.sitOut)) startBetting();
  }

  function statusFor(id) {
    const p = find(id);
    if (!p) {
      const s = findSpec(id);
      if (s) A('관전 중입니다. ' + T.players.length + '명 플레이 중, ' + (T.phase === 'acting' && T.turnId ? find(T.turnId).nick + ' 님 차례.' : ''), id);
      return;
    }
    const dv = T.dealer.length ? BJ.cardNameKo(T.dealer[0]) : '없음';
    const h = p.hands[p.activeHand] || [];
    if (T.phase === 'betting') A('베팅 ' + p.bet + ', 보유 칩 ' + p.chips + '. ' + (p.betConfirmed ? '확정됨, 대기 중.' : '에프1 확정.'), id);
    else if (T.phase === 'insurance') A('딜러 오픈 에이스. 당신 카드 ' + handKo(h) + '. ' + (p.insDecided ? (p.insBet > 0 ? '보험 ' + p.insBet + ' 걸었습니다.' : '패스했습니다.') + ' 대기 중.' : '에프1 보험, 에프2 패스.'), id);
    else if (T.phase === 'acting' || T.phase === 'dealer') A('당신 카드 ' + handKo(h) + ', 합계 ' + vKo(h) + '. 딜러 오픈 카드 ' + dv + '. ' + (T.turnId === id ? '당신 차례.' : '대기 중.'), id);
    else if (T.phase === 'result') A((p.results.length ? '결과 ' + p.results.map((r) => RESULT_KO[r.outcome]).join(', ') + '. ' : '') + '보유 칩 ' + p.chips + '. 에프1 준비.', id);
    else A('대기실입니다. 호스트가 게임을 시작하면 베팅이 열립니다.', id);
  }

  /* ── 액션 진입점 ── */
  function action(id, act, val) {
    if (act === 'status') return statusFor(id);
    if (act === 'rules') {
      A('블랙잭 규칙. 21에 가까우면 승리, 넘으면 버스트. 에이스는 1 또는 11. 딜러는 16 이하 히트, 17 스탠드. 블랙잭은 1.5배. 같은 숫자 두 장은 스플릿. 딜러가 에이스면 보험.', id);
      return;
    }
    if (act === 'emote') {
      const who = find(id) || findSpec(id);
      if (!who) return;
      const now = Date.now();
      if (now - (who._emoteAt || 0) < 4000) { A('잠시 후 다시 보낼 수 있습니다.', id); return; }
      who._emoteAt = now;
      const txt = EMOTES[val] || EMOTES[0];
      A(who.nick + ': ' + txt, undefined, 'emote');
      return;
    }
    if (act === 'set') {
      if (!isHost(id)) { A('호스트만 설정을 바꿀 수 있습니다.', id); return; }
      const { key, value } = val || {};
      if (key === 'turnTimeout' && [0, 15000, 30000, 60000].includes(value)) {
        T.opts.turnTimeout = value;
        A('턴 제한시간 ' + (value ? value / 1000 + '초' : '없음') + '으로 설정.');
      } else if (key === 'dealerDelay' && [500, 900, 1500].includes(value)) {
        T.opts.dealerDelay = value;
        A('딜러 속도 ' + { 500: '빠름', 900: '보통', 1500: '천천히' }[value] + '으로 설정.');
      } else if (key === 'scoreMode') {
        T.opts.scoreMode = !!value;
        A(T.opts.scoreMode ? '점수 모드로 전환. 칩 대신 점수로 표시됩니다.' : '기본 모드로 전환.');
      }
      emit();
      return;
    }

    const p = find(id);
    if (!p) { if (findSpec(id)) A('관전 중에는 참여할 수 없습니다. 자리가 나면 자동 참가됩니다.', id); return; }

    if (T.phase === 'lobby') {
      if (act === 'start') {
        if (!isHost(id)) { A('호스트만 시작할 수 있습니다.', id); return; }
        startBetting(); return;
      }
      A('대기실입니다. 잠시만요.', id);
    } else if (T.phase === 'betting') {
      if (p.sitOut) { A('이번 판은 관전입니다.', id); return; }
      if (p.betConfirmed) { A('이미 확정했습니다. 다른 플레이어를 기다리는 중.', id); return; }
      if (act === 'bet+') return adjustBet(p, 1);
      if (act === 'bet-') return adjustBet(p, -1);
      if (act === 'confirm') {
        p.betConfirmed = true;
        A('베팅 ' + p.bet + ' 확정.', id);
        emit();
        return checkAllConfirmed();
      }
      A('팬 키로 베팅 조절, 에프1 확정, 에프2 규칙 설명.', id);
    } else if (T.phase === 'insurance') {
      if (p.sitOut || !p.handBets.length) { A('이번 판은 관전입니다.', id); return; }
      if (p.insDecided) { A('이미 결정했습니다. 다른 플레이어 대기 중.', id); return; }
      if (act === 'insure') {
        const cost = Math.ceil(p.bet / 2);
        if (p.chips < cost) { A('보험을 걸 칩이 부족합니다.', id); return; }
        p.chips -= cost; p.insBet = cost; p.insDecided = true;
        A('보험 ' + cost + ' 걸었습니다.', id);
        emit();
        if (allInsDecided()) resolveInsurance();
        return;
      }
      if (act === 'pass' || act === 'stand') {
        p.insDecided = true;
        A('보험 패스.', id);
        emit();
        if (allInsDecided()) resolveInsurance();
        return;
      }
      A('에프1 보험(베팅의 절반), 에프2 패스.', id);
    } else if (T.phase === 'acting') {
      if (T.turnId !== id) { A('아직 당신 차례가 아닙니다. 잠시만요.', id); return; }
      if (act === 'hit') { clearTurnTimer(); return doHit(p, false); }
      if (act === 'stand') { clearTurnTimer(); A('스탠드.', id); return doStand(p); }
      if (act === 'double') {
        if (!canDouble(p)) { A('더블다운은 첫 두 장에서 칩이 충분할 때만 가능합니다.', id); return; }
        clearTurnTimer();
        p.chips -= p.handBets[p.activeHand];
        p.handBets[p.activeHand] *= 2;
        A('더블다운. 베팅 ' + p.handBets[p.activeHand] + '. 카드 한 장.', id);
        return doHit(p, true);
      }
      if (act === 'split') {
        if (!canSplit(p)) { A('스플릿은 같은 숫자 두 장이고 칩이 충분할 때만 가능합니다.', id); return; }
        clearTurnTimer();
        return doSplit(p);
      }
      A('에프1 히트, 에프2 스탠드' + (canDouble(p) ? ', 에프3 더블다운' : '') + (canSplit(p) ? ', 팬 오른쪽 스플릿' : '') + '.', id);
    } else if (T.phase === 'dealer') {
      A('잠시만요. 딜러가 카드를 뽑는 중입니다.', id);
    } else if (T.phase === 'result') {
      if (act === 'ready') {
        if (p.chips <= 0) { A('칩이 없습니다. 호스트가 새 게임을 시작할 때까지 관전합니다.', id); return; }
        if (p.ready) { A('이미 준비 완료. 대기 중.', id); return; }
        p.ready = true;
        A('준비 완료. 다른 플레이어 대기 중.', id);
        emit();
        return checkAllReady();
      }
      if (act === 'newgame') {
        if (!isHost(id)) { A('호스트만 가능합니다.', id); return; }
        T.players.forEach((x) => { x.chips = START_CHIPS; x.bet = 25; });
        A('새 게임. 모두 칩 ' + START_CHIPS + '개로 시작합니다.');
        return startBetting();
      }
      A('에프1을 누르면 다음 판 준비 완료.', id);
    }
  }

  function seed({ players = [], round = 0, opts = {} }) {
    T.round = round;
    T.opts = { ...T.opts, ...opts };
    players.forEach(({ id, nick, chips }) => {
      const p = { id, nick, chips, bet: 25, betConfirmed: false, sitOut: chips <= 0, _emoteAt: 0 };
      freshHand(p);
      T.players.push(p);
    });
  }

  function notify(text, to) { A(text, to); }

  return { state: T, publicState, addPlayer, removePlayer, action, startBetting, seed, notify };
}
