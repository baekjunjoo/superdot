/* Lobby.jsx — 레퍼런스 스타일 로비 (사이드바 + 히어로 + 게임 타일) */
import React, { useState } from 'react';
import { IMG, imgFallback } from '../assets.js';
import { getPrefs } from '../prefs.js';

export default function Lobby({ nick, setNick, onCreate, onJoin, onSolo, onHighLow, prefillCode }) {
  const [code, setCode] = useState(prefillCode || '');
  const [mode, setMode] = useState('online'); // online | local

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

      <section className="my-stats" aria-label="내 기록">
        <h3 className="section-title"><span className="accent">●</span> 내 기록</h3>
        <div className="stats-row">
          <span className="stats-today">오늘 <strong>{stats.todayGames}</strong>판 · 승률 <strong>{todayRate}%</strong></span>
          <span>누적 <strong>{stats.games}</strong>판</span>
          <span>전체 승률 <strong>{winRate}%</strong></span>
          <span>블랙잭 <strong>{stats.blackjacks}</strong>회</span>
          <span>최고 칩 <strong>{stats.bestChips}</strong></span>
        </div>
      </section>

      <h3 className="section-title"><span className="accent">●</span> 게임</h3>
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
