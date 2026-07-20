/* Solo.jsx — 연습(싱글) 모드: v1 컨트롤러 그대로 사용 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import BLE from '../dotpad/ble.js';
import { createGame } from '../game/controller.js';
import { W, H } from '../dotpad/frame.js';
import { toUnicodeBraille } from '../dotpad/braille-core.js';
import { HandView } from './CardView.jsx';
import { handValue } from '../game/blackjack.js';

const KEY_LABELS = {
  bet: { F1: '베팅 확정', F2: '규칙 설명', F3: null, F4: '상태 읽기' },
  player: { F1: '히트', F2: '스탠드', F3: '더블다운', F4: '상태 읽기' },
  dealer: { F1: null, F2: null, F3: null, F4: '상태 읽기' },
  result: { F1: '다음 판', F2: null, F3: null, F4: '결과 읽기' },
  over: { F1: '새 게임(2회)', F2: null, F3: null, F4: '상태 읽기' }
};

export default function Solo({ say, log, onLeave }) {
  const [, force] = useState(0);
  const [bleStatus, setBleStatus] = useState('연결 안 됨');
  const gameRef = useRef(null);
  const canvasRef = useRef(null);

  if (!gameRef.current) gameRef.current = createGame({ say });
  const game = gameRef.current;

  useEffect(() => {
    BLE.frameProvider = () => { const f = game.frame(); return { rows: f.rows, textHex: f.textHex }; };
    BLE.onKeyHandler = (k) => game.onKey(k);
    BLE.onStatus = (code, detail) => {
      setBleStatus(code === 'connected' ? '연결됨' : '연결 안 됨');
      say({
        'connected': '닷패드 연결됨: ' + (detail || ''),
        'disconnected': '닷패드 연결 해제됨',
        'no-bluetooth': 'Web Bluetooth 미지원 브라우저입니다.',
        'connect-fail': '연결 실패'
      }[code] || code);
      if (code === 'connected') game.readStatus();
    };
    const unsub = game.subscribe(() => { BLE.requestFlush(); force((n) => n + 1); });
    game.intro();
    return () => { unsub(); BLE.frameProvider = null; BLE.onKeyHandler = null; BLE.onStatus = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const map = { '1': 'F1', '2': 'F2', '3': 'F3', '4': 'F4', 'ArrowLeft': 'PAN_LEFT', 'ArrowRight': 'PAN_RIGHT' };
      const k = map[e.key];
      if (k) { e.preventDefault(); game.onKey(k); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const px = 6;
    ctx.fillStyle = '#101014';
    ctx.fillRect(0, 0, W * px, H * px);
    const { buf } = game.frame();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.fillStyle = buf[y * W + x] ? '#ea5414' : '#26262c';
      ctx.beginPath();
      ctx.arc(x * px + px / 2, y * px + px / 2, buf[y * W + x] ? px * 0.36 : px * 0.13, 0, 7);
      ctx.fill();
    }
  });

  const st = game.state;
  const labels = KEY_LABELS[st.phase] || KEY_LABELS.bet;
  const inPlay = st.phase !== 'bet' && st.phase !== 'over';

  return (
    <div className="room">
      <div className="room-top">
        <span className="phase-badge">연습 모드</span>
        <span className="chips-badge">칩 {st.chips} · 베팅 {st.bet}</span>
        <span className="spacer" />
        <button onClick={() => BLE.connect()}>닷패드 연결</button>
        <span className="ble-status" role="status">{bleStatus}</span>
        <button onClick={onLeave}>로비로</button>
      </div>

      {inPlay && (
        <>
          <section className="dealer-area">
            <div className="area-label">딜러 {st.dealer.length > 0 && <em>{handValue(st.hideHole ? [st.dealer[0]] : st.dealer).total}{st.hideHole ? '+?' : ''}</em>}</div>
            <HandView cards={st.hideHole ? [st.dealer[0], { hidden: true }] : st.dealer} size="lg" label="딜러 카드" />
          </section>
          <section className="dealer-area">
            <div className="area-label">나 {st.player.length > 0 && <em>{handValue(st.player).total}</em>}</div>
            <HandView cards={st.player} size="lg" label="내 카드" />
          </section>
        </>
      )}

      <section className="controls" aria-label="게임 조작">
        <button onClick={() => game.onKey('PAN_LEFT')} disabled={st.phase !== 'bet'}>◀ 팬</button>
        {['F1', 'F2', 'F3', 'F4'].map((k) => (
          <button key={k} className={k === 'F1' ? 'btn-primary' : ''} onClick={() => game.onKey(k)} disabled={!labels[k]}>
            {k} {labels[k] || '—'}
          </button>
        ))}
        <button onClick={() => game.onKey('PAN_RIGHT')} disabled={st.phase !== 'bet'}>팬 ▶</button>
      </section>

      <div className="dotpad-panel">
        <canvas ref={canvasRef} width={W * 6} height={H * 6} aria-label="닷패드 미리보기" />
        <div className="textline">
          <span className="braille" aria-hidden="true">{toUnicodeBraille(game.status())}</span>
          <span className="plain">{game.status()}</span>
        </div>
      </div>

      <p className="hint">키보드: 1~4 = F1~F4, ←/→ = 팬</p>
      <section aria-label="안내 로그" className="log" aria-live="polite">
        {log.slice(-8).map((l, i) => <div key={i}>{l}</div>)}
      </section>
    </div>
  );
}
