/* Lobby.jsx — 레퍼런스 스타일 로비 (사이드바 + 히어로 + 게임 타일)
   이미지: 힙스필드 생성 (assets.js — 로컬 우선, CDN 폴백)
   첫 진입 튜토리얼(게임 방법): 음성으로 듣기 + 화면 텍스트 (SR·교사 공용) */
import React, { useState, useEffect } from 'react';
import { IMG, imgFallback } from '../assets.js';
import { getPrefs, setPref } from '../prefs.js';

/* 게임 방법 — 한 번에 한 발화로 읽어주고, 화면엔 단계별로 보여줌 */
const TUTORIAL = [
  '목표는 카드 숫자의 합을 21에 가깍게, 넘지 않게 만드는 거예요. 딜러보다 높으면 승리. 에이스는 1 또는 11, 그림 카드는 10입니다.',
  '내 차례에는 에프원1이 히트(카드 한 장 더 받기), 에프투가 스탠드(지금 카드로 멈추기)예요.',
  '닷패드는 물리 F1~F4와 팬 키로, 화면은 같은 이름의 버튼으로 조작합니다. 키보드는 숫자 1~4가 F1~F4.',
  '언제든 F4를 누르면 지금 상황을 다시 들려주고, F2로 규칙을 들을 수 있어요.',
  '시작하려면 방 만들기를 누르거나 초대 코드로 입장하세요. 혼자 익힐려면 연습 모드, 간단한 게임은 하이·로우를 골라보세요.'
];
const TUT_INTRO = '촉각 블랙잭 게임 방법입니다. ';

let nudgedThisSession = false;   // 세션당 한 번만 첫 방문 안내

export default function Lobby({ nick, setNick, onCreate, onJoin, onSolo, onHighLow, prefillCode, say = () => {} }) {
  const [code, setCode] = useState(prefillCode || '');
  const [mode, setMode] = useState('online'); // online | local
  const [showTut, setShowTut] = useState(false);

  /* 첫 방문 안내(세션 1회): 아직 튜토리얼을 안 본 사용자에게만 짧게 넓지 */
  useEffect(() => {
    if (!getPrefs().seenTutorial && !nudgedThisSession) {
      nudgedThisSession = true;
      say('처음이시면 게임 방법 버튼을 눌러 설명을 들어보세요.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openTutorial() {
    setShowTut(true);
    setPref('seenTutorial', true);
    say(TUT_INTRO + TUTORIAL.join(' '));
  }

  function join(e) {
    e.preventDefault();
    if (code.trim()) onJoin(code.trim().toUpperCase(), mode);
  }

  const stats = getPrefs().stats;
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const todayRate = stats.todayGames ? Math.round((stats.todayWins / stats.todayGames) * 100) : 0;

  return (
    <div className="lobby">
      <section className="hero">
        <div className="hero-text">
          <h2><span className="accent">촉각 블랙잭</span>,<br />함께 즐기는 카드 게임</h2>
          <p>시각장애인은 웹과 닷패드로, 비시각장애인은 웹으로.<br />같은 테이블에서 같은 게임을 즐기세요.</p>
          <div className="hero-cta">
            <label className="nick-label">
              닉네임
              <input value={nick} maxLength={10} onChange={(e) => setNick(e.target.value)} aria-label="닉네임" />
            </label>
            <button className="btn-primary" onClick={() => onCreate(mode)}>방 만들기</button>
            <button className="btn-outline" onClick={openTutorial} aria-expanded={showTut}>게임 방법</button>
          </div>
          <form className="join-form" onSubmit={join}>
            <input
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="초대 코드 6자리" maxLength={6} aria-label="초대 코드"
            />
            <button type="submit" className="btn-outline">코드로 입장</button>
            <label className="mode-toggle">
              <input type="checkbox" checked={mode === 'local'} onChange={(e) => setMode(e.target.checked ? 'local' : 'online')} />
              같은 컴퓨터 데모 모드
            </label>
          </form>
        </div>
        <div className="hero-art">
          <img src={IMG.hero.local} alt="" onError={imgFallback('hero')} />
        </div>
      </section>

      {showTut && (
        <section className="tutorial" aria-label="게임 방법" role="region">
          <div className="tutorial-head">
            <h3 className="section-title"><span className="accent" aria-hidden="true">♠</span> 게임 방법</h3>
            <div className="tutorial-actions">
              <button onClick={() => say(TUT_INTRO + TUTORIAL.join(' '))}>다시 듣기</button>
              <button onClick={() => setShowTut(false)}>닫기</button>
            </div>
          </div>
          <ol className="tutorial-steps">
            {TUTORIAL.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>
      )}

      <section className="my-stats" aria-label="내 기록">
        <h3 className="section-title"><span className="accent" aria-hidden="true">♠</span> 내 기록</h3>
        <div className="stats-row">
          <span className="stats-today">오늘 <strong>{stats.todayGames}</strong>판 · 승률 <strong>{todayRate}%</strong></span>
          <span>누적 <strong>{stats.games}</strong>판</span>
          <span>전체 승률 <strong>{winRate}%</strong></span>
          <span>블랙잭 <strong>{stats.blackjacks}</strong>회</span>
          <span>최고 칩 <strong>{stats.bestChips}</strong></span>
        </div>
      </section>

      <h3 className="section-title"><span className="accent" aria-hidden="true">♠</span> 게임</h3>
      <div className="tiles">
        <button className="tile" onClick={() => onCreate(mode)}>
          <div className="tile-head"><strong>BJ</strong><span>멀티 블랙잭</span></div>
          <img src={IMG.cards.local} alt="" onError={imgFallback('cards')} />
          <span className="tile-cta">방 만들기</span>
        </button>
        <button className="tile" onClick={onSolo}>
          <div className="tile-head"><strong>SOLO</strong><span>연습 모드</span></div>
          <img src={IMG.chips.local} alt="" onError={imgFallback('chips')} />
          <span className="tile-cta">혼자 연습</span>
        </button>
        <button className="tile" onClick={onHighLow}>
          <div className="tile-head"><strong>HI·LO</strong><span>하이·로우</span></div>
          <img src={IMG.cardback.local} alt="" onError={imgFallback('cardback')} />
          <span className="tile-cta">혼자 즐기기</span>
        </button>
        <div className="tile tile-info">
          <div className="tile-head"><strong>DOTPAD</strong><span>닷패드 지원</span></div>
          <img src={IMG.dotpad.local} alt="" onError={imgFallback('dotpad')} />
          <span className="tile-cta">방 입장 후 연결</span>
        </div>
      </div>
    </div>
  );
}
