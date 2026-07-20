/* App.jsx — 셸(사이드바+톱바, 레퍼런스 스타일) + 라우팅(로비/방/연습)
   시각장애인(웹+닷패드) + 비장애인(웹) 크로스 플레이
   v3: 설정(발화 속도·짧은 안내·한국 점자·효과음), 닉네임/ID 영속화(재접속 복구) */
import React, { useCallback, useState } from 'react';
import Lobby from './ui/Lobby.jsx';
import Room from './ui/Room.jsx';
import Solo from './ui/Solo.jsx';
import HighLow from './ui/HighLow.jsx';
import { createRoomClient } from './net/client.js';
import { supabaseTransport, localTransport, makeRoomCode } from './net/transport.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { speak, setSpeechEnabled } from './speech.js';
import { getPrefs, setPref } from './prefs.js';

function randomNick() { return '게스트' + Math.floor(100 + Math.random() * 900); }

export default function App() {
  const prefs = getPrefs();
  const [view, setView] = useState({ name: 'lobby' });
  const [nick, setNickState] = useState(prefs.nick || randomNick());
  const [tts, setTts] = useState(true);
  const [ttsRate, setTtsRate] = useState(prefs.ttsRate);
  const [quietOthers, setQuietOthers] = useState(prefs.quietOthers);
  const [skipSpeech, setSkipSpeech] = useState(prefs.skipSpeech);
  const [lang, setLang] = useState(prefs.lang || (prefs.brailleKo ? 'ko' : 'en'));
  const [sfxOn, setSfxOn] = useState(prefs.sfx);
  const [log, setLog] = useState([]);

  const setNick = (v) => { setNickState(v); setPref('nick', v); };

  /* kind==='others'(다른 플레이어 진행)는 짧은 안내 모드에서 음성 생략(로그어 남음) */
  const say = useCallback((txt, kind) => {
    if (!(kind === 'others' && getPrefs().quietOthers)) speak(txt);
    setLog((l) => [...l.slice(-99), txt]);
  }, []);

  const params = new URLSearchParams(location.search);
  const prefillCode = (params.get('room') || '').toUpperCase();
  const prefillMode = params.get('mode') === 'local' ? 'local' : 'online';

  async function makeTransport(code, mode) {
    if (mode === 'local') return localTransport(code);
    try {
      return await supabaseTransport(code, { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
    } catch (e) {
      say('온라인 연결에 실패해 데모 모드로 전환합니다.');
      return localTransport(code);
    }
  }

  async function enterRoom(code, mode, isHost) {
    const me = { id: getPrefs().pid, nick: nick.trim() || randomNick() };
    say(isHost ? '방을 만드는 중…' : '방에 입장하는 중…');
    try {
      const transport = await makeTransport(code, mode);
      const client = createRoomClient({
        transport, me, isHost, say,
        engineOpts: isHost ? { ...getPrefs().roomOpts } : {}   // 호스트: 저장된 방 설정으로 시작
      });
      await client.join();
      setView({ name: 'room', code, mode, isHost, me, client });
      say((isHost ? '방이 만들어졌습니다. 초대 코드 ' : '입장했습니다. 방 코드 ') + code.split('').join(' ') +
        (isHost ? '. 초대 링크 복사 버튼으로 친구를 부르세요. 에프원로 게임 시작.' : '.'));
    } catch (e) {
      say('입장 실패: ' + (e && e.message ? e.message : '알 수 없는 오류'));
    }
  }

  function leaveRoom() {
    if (view.client) view.client.leave();
    history.replaceState(null, '', location.pathname);
    setView({ name: 'lobby' });
    say('로비로 돌아왔습니다.');
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="메뉴">
        <div className="logo">
          <span className="logo-mark">♠</span>
          <span className="logo-text">TACTILE<br />BLACKJACK</span>
        </div>
        <nav>
          <button className={view.name === 'lobby' ? 'nav-active' : ''} onClick={() => view.name !== 'room' ? setView({ name: 'lobby' }) : say('방에서 나가기를 먼저 눌러주세요.')}>메인</button>
          <button onClick={() => view.name === 'lobby' && enterRoom(makeRoomCode(), 'online', true)}>방 만들기</button>
          <button onClick={() => view.name !== 'room' ? setView({ name: 'solo' }) : say('방에서 나가기를 먼저 눌러주세요.')}>연습 모드</button>
        </nav>

        <div className="sidebar-settings" role="group" aria-label="설정">
          <button
            aria-pressed={tts}
            onClick={() => { const v = !tts; setTts(v); setSpeechEnabled(v); say('음성 안내 ' + (v ? '콀' : '끓')); }}>
            음성 {tts ? 'ON' : 'OFF'}
          </button>
          <label className="setting-row">
            <span>음성 속도</span>
            <select
              value={ttsRate}
              onChange={(e) => { const v = parseFloat(e.target.value); setTtsRate(v); setPref('ttsRate', v); say('음성 속도 변경'); }}>
              <option value={0.85}>느리게</option>
              <option value={1.05}>보통</option>
              <option value={1.3}>빠르게</option>
              <option value={1.6}>아주 빠르게</option>
            </select>
          </label>
          <button
            aria-pressed={quietOthers}
            title="다른 플레이어의 카드·차례 발화를 생략 (로그에는 표시)"
            onClick={() => { const v = !quietOthers; setQuietOthers(v); setPref('quietOthers', v); say('짧은 안내 ' + (v ? '콀. 다른 사람 진행은 생략합니다.' : '끓')); }}>
            짧은 안내 {quietOthers ? 'ON' : 'OFF'}
          </button>
          <button
            aria-pressed={skipSpeech}
            title="키를 누르면 진행 중이던 음성을 끊고 바로 다음으로 (숙련자용)"
            onClick={() => { const v = !skipSpeech; setSkipSpeech(v); setPref('skipSpeech', v); say('발화 스킵 ' + (v ? '콀. 키를 누르면 이전 음성을 끊습니다.' : '끓')); }}>
            발화 스킵 {skipSpeech ? 'ON' : 'OFF'}
          </button>
          <label className="setting-row">
            <span>언어</span>
            <select
              value={lang}
              onChange={(e) => {
                const v = e.target.value;
                setLang(v); setPref('lang', v); setPref('brailleKo', v === 'ko');
                say(v === 'ko' ? '닷패드 점자를 한국어로 표시합니다.' : '닷패드 점자를 영어로 표시합니다.');
              }}
              aria-label="언어 설정 (닷패드 점자 표기)">
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </label>
          <button
            aria-pressed={sfxOn}
            onClick={() => { const v = !sfxOn; setSfxOn(v); setPref('sfx', v); say('효과음 ' + (v ? '콀' : '끓')); }}>
            효과음 {sfxOn ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="sidebar-foot">
          <p className="foot-note">Tactile Worlds · Dot Games</p>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="pills">
            <span className={'pill' + (view.name === 'lobby' ? ' pill-active' : '')}>홈</span>
            <span className={'pill' + (view.name === 'room' ? ' pill-active' : '')}>게임룸</span>
            <span className={'pill' + (view.name === 'solo' ? ' pill-active' : '')}>연습</span>
          </div>
          <span className="spacer" />
          <span className="topbar-nick">{nick}</span>
        </header>

        <main>
          {view.name === 'lobby' && (
            <Lobby
              nick={nick} setNick={setNick} say={say}
              prefillCode={prefillCode}
              onCreate={(mode) => enterRoom(makeRoomCode(), mode, true)}
              onJoin={(code, mode) => enterRoom(code, prefillCode === code ? prefillMode : mode, false)}
              onSolo={() => setView({ name: 'solo' })}
              onHighLow={() => setView({ name: 'highlow' })}
            />
          )}
          {view.name === 'highlow' && (
            <HighLow say={say} log={log} onLeave={() => setView({ name: 'lobby' })} />
          )}
          {view.name === 'room' && (
            <Room
              client={view.client} me={view.me} isHost={view.isHost}
              code={view.code} mode={view.mode}
              say={say} log={log} onLeave={leaveRoom}
            />
          )}
          {view.name === 'solo' && (
            <Solo say={say} log={log} onLeave={() => setView({ name: 'lobby' })} />
          )}
        </main>
      </div>
    </div>
  );
}
