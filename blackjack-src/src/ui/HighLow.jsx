/* HighLow.jsx — 하이·로우 싱글 모드 UI (닷패드 + 음성 + 화면)
   현재 카드 크게 표시 + 하이/로우 버튼 + 스트릭. Solo와 동일한 접근성 패턴. */
import React, { useEffect, useRef, useState } from 'react';
import BLE from '../dotpad/ble.js';
import { createHighLow } from '../game/highlowController.js';
import { W, H } from '../dotpad/frame.js';
import { toUnicodeBraille } from '../dotpad/braille-core.js';
import { CardView } from './CardView.jsx';
import { sfx } from '../sfx.js';
import { IMG, imgFallback } from '../assets.js';

export default function HighLow({ say, log, onLeave }) {
  const [, force] = useState(0);
  const [bleStatus, setBleStatus] = useState('연결 안 됨');
  const gameRef = useRef(null);
  const canvasRef = useRef(null);
  const prevLast = useRef(null);

  if (!gameRef.current) gameRef.current = createHighLow({ say });
  const game = gameRef.current;

  useEffect(() => {
    BLE.frameProvider = () => { const f = game.frame(); return { rows: f.rows, textHex: f.textHex }; };
    BLE.onKeyHandler = (k) => game.onKey(k);
    BLE.onStatus = (code, detail) => {
      setBleStatus(code === 'connected' ? '연결됨' : '연결 안 됨');
      say({ connected: '닷패드 연결됨', disconnected: '닷패드 연결 해제됨', 'no-bluetooth': 'Web Bluetooth 미지원 브라우저입니다.', 'connect-fail': '연결 실패' }[code] || code);
      if (code === 'connected') game.readStatus();
    };
    const unsub = game.subscribe(() => {
      BLE.requestFlush(); force((n) => n + 1);
      const l = game.state.last;
      if (l && l !== prevLast.current) {
        if (l === 'win') { sfx.win(); sfx.vibrate([80]); }
        else if (l === 'lose') sfx.lose();
        prevLast.current = l;
      }
    });
    game.start();
    return () => { unsub(); BLE.frameProvider = null; BLE.onKeyHandler = null; BLE.onStatus = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const map = { '1': 'F1', '2': 'F2', '4': 'F4' };
      if (map[e.key]) { e.preventDefault(); game.onKey(map[e.key]); }
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
  const over = st.phase === 'over';

  return (
    <div className="room">
      <div className="room-top">
        <span className="phase-badge">하이·로우</span>
        <span className="chips-badge">점수 {st.score} · {st.streak}연승 · 최고 {st.best}</span>
        <span className="spacer" />
        <button onClick={() => BLE.connect()}>닷패드 연결</button>
        <span className="ble-status" role="status">{bleStatus}</span>
        <button onClick={onLeave}>로비로</button>
      </div>

      <div className="hl-stage">
        <img className="hl-felt" src={IMG.tablefelt.local} alt="" onError={imgFallback('tablefelt')} aria-hidden="true" />
        <div className="hl-card-wrap" aria-label={'현재 카드 ' + (st.current ? st.current.r : '')}>
          {st.current && <CardView card={st.current} size="lg" />}
          {st.next && st.last && (
            <span className={'badge pk-pop badge-' + (st.last === 'win' ? 'win' : st.last === 'lose' ? 'lose' : 'push')}>
              {st.last === 'win' ? '정답' : st.last === 'lose' ? '실패' : '무승부'}
            </span>
          )}
        </div>
        <p className="hl-prompt">{over ? '게임 종료 · F1 다시 시작' : '다음 카드가 더 높을까요, 낮을까요?'}</p>
      </div>

      <section className="controls" aria-label="게임 조작">
        {over
          ? <button className="btn-primary pk-big-btn" onClick={() => game.onKey('F1')}>다시 시작 (F1)</button>
          : (<>
              <button className="btn-primary pk-big-btn" onClick={() => game.onKey('F1')}>하이 ▲ (F1)</button>
              <button className="pk-big-btn" onClick={() => game.onKey('F2')}>로우 ▼ (F2)</button>
            </>)}
        <button onClick={() => game.onKey('F4')}>상태 읽기 (F4)</button>
      </section>

      <div className="dotpad-panel">
        <canvas ref={canvasRef} width={W * 6} height={H * 6} aria-label="닷패드 미리보기 (현재 카드)" />
        <div className="textline">
          <span className="braille" aria-hidden="true">{toUnicodeBraille(game.status())}</span>
          <span className="plain">{game.status()}</span>
        </div>
      </div>

      <p className="hint">키보드: 1 = 하이, 2 = 로우, 4 = 상태 · 닷패드: F1 하이, F2 로우, F4 상태</p>
      <section aria-label="안내 로그" className="log log-scroll" aria-live="polite">
        {log.slice(-30).map((l, i) => <div key={i}>{l}</div>)}
      </section>
    </div>
  );
}
