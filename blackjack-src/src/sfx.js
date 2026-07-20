/* sfx.js — WebAudio 합성 효과음 (에셋 불필요, TTS와 별도 채널·별도 토글)
   미란 케이스 배려: 기본 음량 낮게(0.25), 설정에서 끌 수 있음 */

import { getPrefs } from './prefs.js';

let ctx = null;
function ac() {
  if (!getPrefs().sfx) return null;
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (_) { return null; }
}

function tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + when); o.stop(c.currentTime + when + dur);
}

export const sfx = {
  deal() { tone(660, 0.05, 'triangle', 0.15); tone(880, 0.05, 'triangle', 0.12, 0.06); },   // 카드 스륵
  chip() { tone(1400, 0.03, 'square', 0.1); },                                              // 칩 클릭
  win() { tone(523, 0.1, 'sine', 0.22); tone(659, 0.1, 'sine', 0.22, 0.1); tone(784, 0.18, 'sine', 0.22, 0.2); },
  lose() { tone(180, 0.25, 'sawtooth', 0.12); },
  emote() { tone(988, 0.06, 'triangle', 0.15); },
  vibrate(pattern = [80, 40, 80]) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) {} }
};
