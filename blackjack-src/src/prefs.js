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
  skipSpeech: false,    // 발화 스킵: 다음 키를 누르면 진행 중 발화를 끊음
  lang: 'en',           // 언어 설정: 'ko'(한국어) | 'en'(English) — 닷패드 점자 표기 기준
  brailleKo: false,     // (구버전 호환 필드)
  sfx: true,            // 효과음 (TTS와 분리)
  roomOpts: { turnTimeout: 30000, dealerDelay: 900, scoreMode: false }, // 방 기본 설정(호스트)
  stats: { games: 0, wins: 0, blackjacks: 0, bestChips: 0, today: '', todayGames: 0, todayWins: 0 }
};

let cache = null;

export function getPrefs() {
  if (cache) return cache;
  const s = store();
  let saved = {};
  if (s) { try { saved = JSON.parse(s.getItem(KEY) || '{}'); } catch (_) {} }
  cache = {
    ...DEFAULTS, ...saved,
    stats: { ...DEFAULTS.stats, ...(saved.stats || {}) },
    roomOpts: { ...DEFAULTS.roomOpts, ...(saved.roomOpts || {}) }
  };
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

/* 라운드 결과 기록 (outcome: blackjack|win|push|lose|bust, chips: 현재 보유)
   누적 + 오늘 성적(날짜 바뀌면 리셋) */
export function recordResult(outcome, chips) {
  const p = getPrefs();
  const today = new Date().toISOString().slice(0, 10);
  if (p.stats.today !== today) { p.stats.today = today; p.stats.todayGames = 0; p.stats.todayWins = 0; }
  p.stats.games++; p.stats.todayGames++;
  const won = outcome === 'win' || outcome === 'blackjack';
  if (won) { p.stats.wins++; p.stats.todayWins++; }
  if (outcome === 'blackjack') p.stats.blackjacks++;
  if (chips > p.stats.bestChips) p.stats.bestChips = chips;
  save();
}

/* 방 설정 저장(호스트 기본값) */
export function saveRoomOpt(key, value) {
  const p = getPrefs();
  p.roomOpts[key] = value;
  save();
}
