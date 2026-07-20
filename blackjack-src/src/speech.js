/* speech.js — TTS (tactile-ux: 빠른 연타 시 이전 발화 끊고 최신만 완주,
   TTS OFF 시 aria-live 로그로만 안내 — App.jsx의 로그가 담당)
   발화 속도는 사용자 설정(prefs.ttsRate)
   skipCurrent(): 발화 스킵 설정 시, 진행 중 발화를 즉시 중단(다음 안내를 기다리지 않음) */

import { getPrefs } from './prefs.js';

let enabled = true;

export function setSpeechEnabled(v) { enabled = !!v; }
export function isSpeechEnabled() { return enabled; }

export function speak(txt) {
  if (!enabled) return;
  try {
    const ss = globalThis.speechSynthesis;
    if (!ss) return;
    ss.cancel();                       // 이전 발화 중단(스크린리더 관례)
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'ko-KR';
    u.rate = getPrefs().ttsRate || 1.05;
    ss.speak(u);
  } catch (_) { /* 비지원 환경 무시 */ }
}

/* 진행 중 발화 즉시 중단 (발화 스킵 설정이 켜졌을 때 키 입력 시 호출) */
export function skipCurrent() {
  if (!getPrefs().skipSpeech) return false;
  try {
    const ss = globalThis.speechSynthesis;
    if (ss && ss.speaking) { ss.cancel(); return true; }
  } catch (_) {}
  return false;
}
