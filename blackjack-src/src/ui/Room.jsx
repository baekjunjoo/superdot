/* Room.jsx — 멀티플레이 게임룸 v3
   시각장애인: 닷패드(F1~F4/팬) + 음성. 비시각장애인: 화면 + 버튼/키보드.
   v3: 스플릿(팬 오른쪽), 이모트(숫자 5~0), 관전 모드, 호스트 방 설정(턴 타이머/딜러 속도/점수 모드),
       전적 기록 + 효과음 + 모바일 진동, NVDA 포커스 모드 힌트, 로그 전체 스크롤 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import BLE from '../dotpad/ble.js';
import { renderRoom, roomStatusText } from '../dotpad/render.js';
import { toUnicodeBraille } from '../dotpad/braille-core.js';
import { handValue } from '../game/blackjack.js';
import { EMOTES } from '../game/table.js';
import { HandView } from './CardView.jsx';
import { W, H } from '../dotpad/frame.js';
import { recordResult } from '../prefs.js';
import { sfx } from '../sfx.js';

const PHASE_KO = { lobby: '대기실', betting: '베팅', acting: '플레이', dealer: '딜러 차례', result: '결과' };
const RESULT_KO = { blackjack: '블랙잭', win: '승리', push: '무승부', lose: '패배', bust: '버스트' };

export default function Room({ client, me, isHost, code, mode, say, log, onLeave }) {
  const [st, setSt] = useState(client.state);
  const [bleStatus, setBleStatus] = useState('연결 안 됨');
  const canvasRef = useRef(null);
  const stRef = useRef(st);
  const prevPhase = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    client.onStateChange = (s) => { stRef.current = s; setSt(s); };
    stRef.current = client.state; setSt(client.state);
    return () => { client.onStateChange = null; };
  }, [client]);

  const amHost = isHost || client.isHostNow;

  /* 닷패드/키 → 국면별 액션 매핑 */
  const onGameKey = useCallback((k) => {
    const s = stRef.current;
    if (!s) return;
    if (k === 'F4') return client.sendAction('status');
    if (s.phase === 'lobby') {
      if (k === 'F1' && amHost) return client.sendAction('start');
      if (k === 'F2') return client.sendAction('rules');
      return client.sendAction('status');
    }
    if (s.phase === 'betting') {
      if (k === 'PAN_RIGHT') return client.sendAction('bet+');
      if (k === 'PAN_LEFT') return client.sendAction('bet-');
      if (k === 'F1') return client.sendAction('confirm');
      if (k === 'F2') return client.sendAction('rules');
      return client.sendAction('status');
    }
    if (s.phase === 'acting') {
      if (k === 'F1') return client.sendAction('hit');
      if (k === 'F2') return client.sendAction('stand');
      if (k === 'F3') return client.sendAction('double');
      if (k === 'PAN_RIGHT') return client.sendAction('split');
      return client.sendAction('status');
    }
    if (s.phase === 'result') {
      if (k === 'F1') return client.sendAction('ready');
      return client.sendAction('status');
    }
    return client.sendAction('status');
  }, [client, amHost]);

  /* BLE 배선 */
  useEffect(() => {
    BLE.frameProvider = () => {
      const s = stRef.current;
      if (!s) return { rows: new Array(10).fill('0'.repeat(60)), textHex: '0'.repeat(40) };
      const f = renderRoom(s, me.id);
      return { rows: f.rows, textHex: f.textHex };
    };
    BLE.onKeyHandler = onGameKey;
    BLE.onStatus = (codeMsg, detail) => {
      const msg = {
        'connected': '닷패드 연결됨: ' + (detail || ''),
        'disconnected': '닷패드 연결 해제됨',
        'no-bluetooth': 'Web Bluetooth 미지원 브라우저입니다. Chrome/Edge에서 열어주세요. (iOS는 미지원)',
        'connect-fail': '연결 실패: ' + (detail || ''),
        'error': '기기 오류: ' + (detail || '')
      }[codeMsg] || codeMsg;
      setBleStatus(codeMsg === 'connected' ? '연결됨' : '연결 안 됨');
      say(msg);
      if (codeMsg === 'connected') client.sendAction('status');
    };
    return () => { BLE.frameProvider = null; BLE.onKeyHandler = null; };
  }, [onGameKey, me.id, say, client]);

  /* 상태 변경 → 닷패드 push + 미리보기 + 전적/효과음 */
  useEffect(() => {
    BLE.requestFlush();
    drawPreview();
    const s = st;
    if (!s) return;
    if (prevPhase.current !== s.phase) {
      const meP = s.players.find((p) => p.id === me.id);
      if (s.phase === 'acting' && prevPhase.current === 'betting') sfx.deal();
      if (s.phase === 'result' && meP) {
        const outcomes = meP.results && meP.results.length ? meP.results : (meP.result ? [meP.result] : []);
        outcomes.forEach((o) => recordResult(o, meP.chips));
        if (outcomes.some((o) => o === 'win' || o === 'blackjack')) { sfx.win(); sfx.vibrate([90, 50, 90, 50, 180]); }
        else if (outcomes.length) sfx.lose();
      }
      prevPhase.current = s.phase;
    }
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  });

  /* 키보드: 1~4 = F키, ←/→ = 팬, 5~9/0 = 이모트 */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const map = { '1': 'F1', '2': 'F2', '3': 'F3', '4': 'F4', 'ArrowLeft': 'PAN_LEFT', 'ArrowRight': 'PAN_RIGHT' };
      const emoteMap = { '5': 0, '6': 1, '7': 2, '8': 3, '9': 4, '0': 5 };
      if (map[e.key]) { e.preventDefault(); onGameKey(map[e.key]); }
      else if (emoteMap[e.key] !== undefined) { e.preventDefault(); sfx.emote(); client.sendAction('emote', emoteMap[e.key]); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onGameKey, client]);

  function drawPreview() {
    const cv = canvasRef.current, s = stRef.current;
    if (!cv || !s) return;
    const ctx = cv.getContext('2d');
    const px = 6;
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, W * px, H * px);
    const { buf } = renderRoom(s, me.id);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.fillStyle = buf[y * W + x] ? '#ea5414' : '#26262c';
      ctx.beginPath();
      ctx.arc(x * px + px / 2, y * px + px / 2, buf[y * W + x] ? px * 0.36 : px * 0.13, 0, 7);
      ctx.fill();
    }
  }

  function copyInvite() {
    const link = location.origin + location.pathname + '?room=' + code + (mode === 'local' ? '&mode=local' : '');
    navigator.clipboard.writeText(link).then(
      () => say('초대 링크를 복사했습니다.'),
      () => say('복사 실패. 코드를 직접 알려주세요: ' + code.split('').join(' '))
    );
  }

  if (st === undefined) {
    return <div className="room-closed"><p>방에 접속하는 중…</p></div>;
  }
  if (st === null) {
    return (
      <div className="room-closed">
        <p>방이 종료되었습니다.</p>
        <button className="btn-primary" onClick={onLeave}>로비로</button>
      </div>
    );
  }

  const score = st.opts && st.opts.scoreMode;
  const CHIP = score ? '점수' : '칩';
  const BET = score ? '점수' : '베팅';
  const meP = st.players.find((p) => p.id === me.id);
  const amSpectator = !meP && st.spectators && st.spectators.some((s) => s.id === me.id);
  const myTurn = st.phase === 'acting' && st.turnId === me.id;
  const dealerShown = st.dealer.filter((c) => !c.hidden);
  const dealerTotal = dealerShown.length ? handValue(dealerShown).total : 0;
  const canSplitNow = meP && myTurn && meP.hands && meP.hands.length === 1 &&
    meP.cards.length === 2 && meP.cards[0].r === meP.cards[1].r && meP.chips >= meP.bet;

  /* 국면별 조작 버튼 */
  function controls() {
    if (amSpectator) return <p className="wait-note">관전 중 — 자리가 나면 자동으로 참가합니다. 이모트와 F4 상태 읽기를 쓸 수 있어요.</p>;
    if (st.phase === 'lobby') {
      return amHost
        ? <button className="btn-primary" onClick={() => client.sendAction('start')}>게임 시작 (F1)</button>
        : <p className="wait-note">호스트가 시작하기를 기다리는 중…</p>;
    }
    if (st.phase === 'betting') {
      if (meP && meP.sitOut) return <p className="wait-note">{CHIP}이 없어 이번 판은 관전합니다.</p>;
      return (
        <>
          <button onClick={() => client.sendAction('bet-')} disabled={meP && meP.betConfirmed}>◀ {BET}</button>
          <button className="btn-primary" onClick={() => client.sendAction('confirm')} disabled={meP && meP.betConfirmed}>
            {BET} {meP ? meP.bet : ''} 확정 (F1)
          </button>
          <button onClick={() => client.sendAction('bet+')} disabled={meP && meP.betConfirmed}>{BET} ▶</button>
          <button onClick={() => client.sendAction('rules')}>규칙 (F2)</button>
        </>
      );
    }
    if (st.phase === 'acting') {
      return (
        <>
          <button className="btn-primary" onClick={() => client.sendAction('hit')} disabled={!myTurn}>히트 (F1)</button>
          <button onClick={() => client.sendAction('stand')} disabled={!myTurn}>스탠드 (F2)</button>
          <button onClick={() => client.sendAction('double')} disabled={!myTurn}>더블다운 (F3)</button>
          <button onClick={() => client.sendAction('split')} disabled={!canSplitNow} title="같은 숫자 두 장일 때 (팬 오른쪽)">스플릿 (팬▶)</button>
        </>
      );
    }
    if (st.phase === 'result') {
      const allBroke = st.players.length && st.players.every((p) => p.chips <= 0);
      return (
        <>
          <button className="btn-primary" onClick={() => client.sendAction('ready')} disabled={meP && (meP.ready || meP.chips <= 0)}>
            다음 판 준비 (F1)
          </button>
          {amHost && allBroke && <button onClick={() => client.sendAction('newgame')}>새 게임 ({CHIP} 리셋)</button>}
        </>
      );
    }
    return <p className="wait-note">딜러가 카드를 뽑는 중…</p>;
  }

  /* 호스트 방 설정 */
  function hostSettings() {
    if (!amHost) return null;
    const o = st.opts || {};
    return (
      <div className="host-settings" role="group" aria-label="방 설정 (호스트)">
        <label>턴 제한
          <select value={o.turnTimeout} onChange={(e) => client.sendAction('set', { key: 'turnTimeout', value: parseInt(e.target.value, 10) })}>
            <option value={0}>없음</option>
            <option value={15000}>15초</option>
            <option value={30000}>30초</option>
            <option value={60000}>60초</option>
          </select>
        </label>
        <label>딜러 속도
          <select value={o.dealerDelay} onChange={(e) => client.sendAction('set', { key: 'dealerDelay', value: parseInt(e.target.value, 10) })}>
            <option value={500}>빠름</option>
            <option value={900}>보통</option>
            <option value={1500}>천천히</option>
          </select>
        </label>
        <button
          aria-pressed={!!o.scoreMode}
          title="수업용: 칩·베팅을 점수로 표시"
          onClick={() => client.sendAction('set', { key: 'scoreMode', value: !o.scoreMode })}>
          점수 모드 {o.scoreMode ? 'ON' : 'OFF'}
        </button>
      </div>
    );
  }

  return (
    <div className="room">
      <div className="room-top">
        <span className="room-code" aria-label={'방 코드 ' + code.split('').join(' ')}>방 코드 <strong>{code}</strong></span>
        <button onClick={copyInvite}>초대 링크 복사</button>
        <span className="phase-badge">{PHASE_KO[st.phase]}{st.round ? ' · ' + st.round + 'R' : ''}</span>
        {amSpectator && <span className="badge badge-turn">관전</span>}
        <span className="spacer" />
        <button onClick={() => BLE.connect()}>닷패드 연결</button>
        <span className="ble-status" role="status">{bleStatus}</span>
        <button onClick={onLeave}>나가기</button>
      </div>

      {hostSettings()}

      <section className="dealer-area" aria-label={'딜러 카드, 합계 ' + dealerTotal}>
        <div className="area-label">딜러 {st.dealer.length > 0 && <em>{dealerTotal}{st.hideHole ? '+?' : ''}</em>}</div>
        <HandView cards={st.dealer} size="lg" label="딜러 카드" />
      </section>

      <section className="seats" aria-label="플레이어">
        {st.players.map((p) => {
          const turn = st.phase === 'acting' && st.turnId === p.id;
          const hands = p.hands && p.hands.length ? p.hands : [p.cards];
          return (
            <div key={p.id} className={'seat' + (turn ? ' seat-turn' : '') + (p.id === me.id ? ' seat-me' : '')}>
              <div className="seat-head">
                <strong>{p.nick}{p.id === me.id ? ' (나)' : ''}</strong>
                <span className="seat-chips">{CHIP} {p.chips}</span>
              </div>
              <div className="seat-bet">
                {BET} {p.bet}
                {st.phase === 'betting' && (p.betConfirmed ? ' ✓확정' : ' …')}
                {p.sitOut && ' · 관전'}
                {st.phase === 'result' && p.ready && ' · 준비✓'}
              </div>
              {hands.map((h, hi) => {
                const v = h && h.length ? handValue(h).total : null;
                const res = p.results && p.results[hi];
                return (
                  <div key={hi} className={'seat-hand' + (hands.length > 1 && p.activeHand === hi && turn ? ' seat-hand-active' : '')}>
                    <HandView cards={h || []} size="sm" label={p.nick + ' 카드' + (hands.length > 1 ? ' ' + (hi + 1) : '')} />
                    <div className="seat-status">
                      {v != null && <span>합계 {v}</span>}
                      {res && <span className={'badge badge-' + res}>{RESULT_KO[res]}</span>}
                      {!res && p.result && hands.length === 1 && <span className={'badge badge-' + p.result}>{RESULT_KO[p.result]}</span>}
                      {turn && hi === p.activeHand && <span className="badge badge-turn">차례</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {st.spectators && st.spectators.length > 0 && (
          <div className="seat seat-spectators">
            <div className="seat-head"><strong>관전</strong><span className="seat-chips">{st.spectators.length}명</span></div>
            <div className="seat-bet">{st.spectators.map((s) => s.nick).join(', ')}</div>
          </div>
        )}
      </section>

      <section className="controls" aria-label="게임 조작">
        {controls()}
        <button onClick={() => client.sendAction('status')}>상태 읽기 (F4)</button>
      </section>

      <section className="emotes" aria-label="이모트 (키보드 5~9, 0)">
        {EMOTES.map((t, i) => (
          <button key={i} onClick={() => { sfx.emote(); client.sendAction('emote', i); }}>{t}</button>
        ))}
      </section>

      <div className="dotpad-panel">
        <canvas ref={canvasRef} width={W * 6} height={H * 6} aria-label="닷패드 미리보기 (내 카드와 딜러)" />
        <div className="textline">
          <span className="braille" aria-hidden="true">{toUnicodeBraille(roomStatusText(st, me.id))}</span>
          <span className="plain">{roomStatusText(st, me.id)}</span>
        </div>
      </div>

      <p className="hint">
        키보드: 1~4 = F1~F4, ←/→ = 팬, 5~0 = 이모트 · 닷패드: F1~F4 물리키 + 팬 좌/우 (스플릿 = 팬 오른쪽)
        <br />스크린리더(NVDA 등) 사용 시: 숫자키는 <strong>포커스 모드</strong>에서 동작합니다. 브라우즈 모드에서는 화면 버튼을 이용하세요.
      </p>

      <section aria-label="안내 로그" className="log log-scroll" aria-live="polite" ref={logRef}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </section>
    </div>
  );
}
