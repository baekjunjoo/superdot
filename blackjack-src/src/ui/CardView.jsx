/* CardView.jsx — 화면용 카드 렌더 (포커 테이블 레퍼런스 스타일)
   슈트 상단 + 큰 랭크 하단, 뒷면은 힉스필드 카드백 이미지(실패 시 CSS 패턴 폴백)
   dealIndex: 카드 배분 애니메이션 스태거 지연 */
import React from 'react';
import { IMG, imgFallback } from '../assets.js';

const SUIT_CHAR = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function CardView({ card, size = 'md', dealIndex = 0 }) {
  if (!card) return null;
  const delay = { animationDelay: (dealIndex * 0.12) + 's' };
  if (card.hidden) {
    return (
      <div className={`pcard pcard-${size} pcard-back pk-deal`} style={delay} aria-label="뒤집힌 카드">
        <img className="pcard-backimg" src={IMG.cardback.local} alt="" onError={imgFallback('cardback')} />
        <span className="pcard-backmark" aria-hidden="true">♠</span>
      </div>
    );
  }
  const red = card.s === 'H' || card.s === 'D';
  return (
    <div
      key={card.r + card.s}
      className={`pcard pcard-${size} ${red ? 'pcard-red' : ''} pk-deal`}
      style={delay}
      aria-label={`${SUIT_CHAR[card.s]} ${card.r}`}
    >
      <span className="pcard-suit" aria-hidden="true">{SUIT_CHAR[card.s]}</span>
      <span className="pcard-rank" aria-hidden="true">{card.r}</span>
    </div>
  );
}

export function HandView({ cards, size = 'md', label }) {
  return (
    <div className="hand" role="group" aria-label={label}>
      {cards.map((c, i) => (
        <CardView key={(c && !c.hidden ? c.r + c.s : 'hidden') + '-' + i} card={c} size={size} dealIndex={i} />
      ))}
    </div>
  );
}
