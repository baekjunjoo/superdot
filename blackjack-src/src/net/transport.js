/* transport.js — 방 통신 추상화
   인터페이스: {send(event,payload), on(event,fn), join(meta), updateMeta(meta), leave(), onPresence(fn)}
   구현 3종:
   - supabaseTransport: Supabase Realtime broadcast+presence (실서비스)
   - localTransport: BroadcastChannel (같은 브라우저 데모/오프라인)
   - memTransport: 인메모리 (테스트) */

export function memHub() {
  const rooms = new Map();
  return {
    channel(code) {
      if (!rooms.has(code)) rooms.set(code, { handlers: [], members: new Map() });
      const room = rooms.get(code);
      return makePeer(room);
    }
  };
  function makePeer(room) {
    const mine = [];
    let meta = null;
    const peer = {
      send(event, payload) {
        room.handlers.forEach((h) => { if (h.peer !== peer && h.event === event) h.fn(payload); });
      },
      on(event, fn) { const h = { event, fn, peer }; room.handlers.push(h); mine.push(h); },
      join(m) { meta = m; room.members.set(peer, m); notifyPresence(room); },
      updateMeta(m) { meta = m; room.members.set(peer, m); notifyPresence(room); },
      leave() {
        room.members.delete(peer);
        mine.forEach((h) => { const i = room.handlers.indexOf(h); if (i >= 0) room.handlers.splice(i, 1); });
        notifyPresence(room);
      },
      onPresence(fn) { peer._pfn = fn; },
      _pfn: null
    };
    return peer;
  }
  function notifyPresence(room) {
    const list = [...room.members.values()];
    room.members.forEach((_, p) => { if (p._pfn) p._pfn(list); });
  }
}

export function localTransport(code) {
  const bc = new BroadcastChannel('bj-' + code);
  const handlers = {};
  const members = new Map();
  let meta = null, pfn = null, hb = null;

  bc.onmessage = (e) => {
    const { event, payload, presence } = e.data || {};
    if (presence) {
      members.set(presence.key, { ...presence.meta, _t: Date.now() });
      firePresence();
      return;
    }
    if (event && handlers[event]) handlers[event].forEach((fn) => fn(payload));
  };
  function firePresence() {
    const now = Date.now();
    [...members.entries()].forEach(([k, v]) => { if (now - v._t > 5000) members.delete(k); });
    if (pfn) pfn([...members.values()]);
  }
  return {
    send(event, payload) { bc.postMessage({ event, payload }); },
    on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
    join(m) {
      meta = m;
      members.set(m.id, { ...m, _t: Date.now() });
      const beat = () => bc.postMessage({ presence: { key: meta.id, meta } });
      beat(); hb = setInterval(() => { beat(); firePresence(); }, 2000);
    },
    updateMeta(m) { meta = m; members.set(m.id, { ...m, _t: Date.now() }); bc.postMessage({ presence: { key: m.id, meta: m } }); firePresence(); },
    leave() { if (hb) clearInterval(hb); bc.close(); },
    onPresence(fn) { pfn = fn; fn([...members.values()]); }
  };
}

export async function supabaseTransport(code, { url, anonKey }) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 20 } } });
  const ch = sb.channel('bj-' + code, { config: { broadcast: { self: false }, presence: { key: 'k' + Math.random().toString(36).slice(2) } } });
  const handlers = {};
  let pfn = null;

  // 모든 이벤트를 구독 전에 선등록 (호스트 승계 시 늦은 등록 문제 방지)
  const EVENTS = ['state', 'announce', 'action', 'hello', 'bye', 'closed', 'handover'];
  EVENTS.forEach((event) => {
    handlers[event] = [];
    ch.on('broadcast', { event }, (msg) => handlers[event].forEach((f) => f(msg.payload)));
  });

  ch.on('presence', { event: 'sync' }, () => {
    if (!pfn) return;
    const st = ch.presenceState();
    const list = Object.values(st).flat();
    pfn(list);
  });

  return {
    send(event, payload) { ch.send({ type: 'broadcast', event, payload }); },
    on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
    join(meta) {
      return new Promise((resolve, reject) => {
        ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') { await ch.track(meta); resolve(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
        });
      });
    },
    updateMeta(meta) { try { ch.track(meta); } catch (_) {} },
    leave() { try { ch.untrack(); sb.removeChannel(ch); } catch (_) {} },
    onPresence(fn) { pfn = fn; }
  };
}

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
