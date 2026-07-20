/* CardView.jsx — 화면용 카드 렌더 (비시각장애인용 시각 표현) */
import React from 'react';

const SUIT_CHAR = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function CardView({ card, size = 'md' }) {
  if (!card) return null;
  if (card.hidden) {
    return (
      <div className={`pcard pcard-${size} pcard-back`} aria-label="뒤집힌 카드">
        <span className="pcard-backmark">◆</span>
      </div>
    );
  }
  const red = card.s === 'H' || card.s === 'D';
  return (
    <div className={`pcard pcard-${size} ${red ? 'pcard-red' : ''}`} aria-label={`${SUIT_CHAR[card.s]} ${card.r}`}>
      <span className="pcard-rank">{card.r}</span>
      <span className="pcard-suit">{SUIT_CHAR[card.s]}</span>
    </div>
  );
}

export function HandView({ cards, size = 'md', label }) {
  return (
    <div className="hand" role="group" aria-label={label}>
      {cards.map((c, i) => <CardView key={i} card={c} size={size} />)}
    </div>
  );
}
