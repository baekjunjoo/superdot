/* prefs.js — 사용자 로컬 설정·기록 (localStorage, 미지원 환경 안전) */

const KEY = 'tbj-prefs';

function store() {
  try { return globalThis.localStorage || null; } catch (_) { return null; }
}

const DEFAULTS = {
  pid: null,            // 플레이어 고유 ID (재접속 복구용)
  nick: '',             // 닉네임
  ttsRate: 1.05,        // 발화 속도
  quietOthers: false,   // 짧은 안내: 다른 플레이어 진행 발화 생략(로그에는 남음)
  brailleKo: false,     // 텍스트라인 한국 점자
  sfx: true,            // 효과음 (TTS와 분리)
  stats: { games: 0, wins: 0, blackjacks: 0, bestChips: 0 }
};

let cache = null;

export function getPrefs() {
  if (cache) return cache;
  const s = store();
  let saved = {};
  if (s) { try { saved = JSON.parse(s.getItem(KEY) || '{}'); } catch (_) {} }
  cache = { ...DEFAULTS, ...saved, stats: { ...DEFAULTS.stats, ...(saved.stats || {}) } };
  if (!cache.pid) { cache.pid = 'p' + Math.random().toString(36).slice(2, 10); save(); }
  return cache;
}

function save() {
  const s = store();
  if (s && cache) { try { s.setItem(KEY, JSON.stringify(cache)); } catch (_) {} }
}

export function setPref(key, val) {
  getPrefs();
  cache[key] = val;
  save();
}

/* 라운드 결과 기록 (outcome: blackjack|win|push|lose|bust, chips: 현재 보유) */
export function recordResult(outcome, chips) {
  const p = getPrefs();
  p.stats.games++;
  if (outcome === 'win' || outcome === 'blackjack') p.stats.wins++;
  if (outcome === 'blackjack') p.stats.blackjacks++;
  if (chips > p.stats.bestChips) p.stats.bestChips = chips;
  save();
}
